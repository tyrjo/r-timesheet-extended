Ext.define("TSTimeSheetApproval", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    layout: 'border', 
    
    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }},
        {xtype:'container', itemId:'display_box' , region: 'center', layout: { type: 'fit'} }
    ],

    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',

    integrationHeaders : {
        name : "TSTimeSheetApproval"
    },
                        
    launch: function() {
        Deft.Chain.pipeline([
            this._loadTimesheets,
            this._loadPreferences
        ],this).then({
            scope: this,
            success: function(timesheets) {
                this._addGrid(this.down('#display_box'), timesheets);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        });
    },
    
    _currentUserCanUnlock: function() {
        this.logger.log('_currentUserCanUnlock',this.getContext().getUser(), this.getContext().getUser().SubscriptionAdmin);
        if ( this.getContext().getUser().SubscriptionAdmin ) {
            return true;
        }
        
        var permissions = this.getContext().getPermissions().userPermissions;
        
        this.logger.log('permissions', this.getContext().getPermissions());
        this.logger.log('user permissions', permissions);

        var workspace_admin_list = Ext.Array.filter(permissions, function(p) {
            return ( p.Role == "Workspace Admin" || p.Role == "Subscription Admin");
        });
        
        var current_workspace_ref = this.getContext().getWorkspace()._ref;
        var can_unlock = false;
        
        this.logger.log('WS Admin list: ', workspace_admin_list);
        
        if ( workspace_admin_list.length > 0 ) {
            Ext.Array.each(workspace_admin_list, function(p){
                console.log('comparing ', p._ref, current_workspace_ref);
                
                if (current_workspace_ref.replace(/\.js$/,'') == p._ref.replace(/\.js$/,'')) {
                    can_unlock = true;
                }
            });
        }
        
        this.logger.log('  ', can_unlock);
        return can_unlock;
    },
    
    _loadTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading timesheets...");
        
        var config = {
            model:'TimeEntryItem',
            limit: 'Infinity',
            context: {
                project: null
            },
            fetch: ['User','WeekStartDate','ObjectID', 'UserName','Values:summary[Hours]']
        };
        
        TSUtilities._loadWsapiRecords(config).then({
            scope: this,
            success: function(results) {
                var timesheets = {};
                
                Ext.Array.each(results, function(item){
                    var key = Ext.String.format("{0}_{1}",
                        item.get('User').ObjectID,
                        Rally.util.DateTime.toIsoString(item.get('WeekStartDate'))
                    );
                    
                    if ( ! timesheets[key] ) {
                        timesheets[key] = Ext.Object.merge( item.getData(), { 
                            __UserName: item.get('User').UserName,
                            __Hours: 0,
                            __Status: "Unknown"
                        });
                    }
                    
                    var hours = timesheets[key].__Hours || 0;
                    
                    timesheets[key].__Hours = this._addHoursFromTimeEntryItem(hours,item);
                    
                },this);
                
                deferred.resolve( Ext.Array.map(Ext.Object.getValues(timesheets), function(timesheet){
                    return Ext.create('TSTimesheet',timesheet);
                }));
                
                this.setLoading(false);
                
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _loadPreferences: function(timesheets) {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading statuses...");
        
        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: [{property:'Name',operator:'contains',value:this._approvalKeyPrefix}],
            fetch: ['Name','Value']
        };
        
        TSUtilities._loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                var preferences_by_key = {};
                
                Ext.Array.each(preferences, function(pref){
                    preferences_by_key[pref.get('Name')] = pref;
                });
                
                Ext.Array.each(timesheets, function(timesheet){
                    console.log(timesheet);
                    var key = timesheet.getPreferenceKey();
                    if (preferences_by_key[key]) {
                        var status_object = Ext.JSON.decode(preferences_by_key[key].get('Value'));
                        timesheet.set('__Status', status_object.status || "Open");
                        timesheet.set('__LastUpdateBy', status_object.status_owner._refObjectName || "");

                    } else { 
                        timesheet.set('__Status', 'Open');
                    }
                });
                this.setLoading(false);
                deferred.resolve(timesheets);
                
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _addHoursFromTimeEntryItem: function(hours,item){
        var summary = item.get('Summary');
        if ( summary && summary.Values && summary.Values.Hours ) {
            var hour_summary = summary.Values.Hours;
            Ext.Object.each(hour_summary, function(key,value){
                hours = hours + ( key * value ) ;
            });
        }
        return hours;
    },

    _addGrid: function(container, timesheets) {
        this.logger.log(timesheets);
        
        var store = Ext.create('Rally.data.custom.Store',{
            data:timesheets,
            groupField: 'User',
            groupDir: 'ASC',
            model: 'TSTimesheet',
            sorters: [{property:'__UserName'}, {property:'WeekStartDate', direction: 'DESC'}],
            getGroupString: function(record) {
                var owner = record.get('User');
                return (owner && owner._refObjectName) || 'No Owner';
            }
        });
        
        var columns = this._getColumns();
        
        container.add({
            xtype:'rallygrid',
            store: store,
            columnCfgs: columns,
            enableEditing: false,
            showRowActionsColumn: false,
            enableBulkEdit: true,
            features: [{
                ftype: 'groupingsummary',
                groupHeaderTpl: '{name} ({rows.length})'
            }],
            _recordIsSelectable: function(record) {
                return true;
            },
            listeners: {
                scope: this,
                itemclick: function(grid, record, item, index, evt) {
                    var column = grid.getPositionByEvent(evt).column;
                    if ( column > 1 ) {
                        this._popup(record);
                    }
                }
            }
        });
    },
    
    _getColumns: function() {
        var columns = [{
            xtype: 'tsrowactioncolumn',
            canUnlock: this._currentUserCanUnlock()
        }];
        
        columns.push({dataIndex:'User',text:'User', renderer: function(v) { return v._refObjectName; }});
        columns.push({dataIndex:'WeekStartDate',text:'Week Starting', align: 'center', renderer: function(v) { return Ext.util.Format.date(v,'m/d/y'); }});
        columns.push({dataIndex:'__Hours',text:'Hours', align: 'center'});
        columns.push({dataIndex:'__Status',text:'Status', align: 'center'});
        columns.push({dataIndex:'__LastUpdateBy',text:'Status Changed By', align: 'center'});
        
        return columns;
    },
    
    _popup: function(record){
        var user_name = record.get('User')._refObjectName;
        var status = record.get('__Status');
        
        var start_date = record.get('WeekStartDate');
        start_date = new Date(start_date.getUTCFullYear(), 
            start_date.getUTCMonth(), 
            start_date.getUTCDate(),  
            start_date.getUTCHours(), 
            start_date.getUTCMinutes(), 
            start_date.getUTCSeconds());
                
        Ext.create('Rally.ui.dialog.Dialog', {
            id       : 'popup',
            width    : Ext.getBody().getWidth() - 20,
            height   : Ext.getBody().getHeight() - 50,
            title    : Ext.String.format("{0}: {1} ({2})", user_name, Ext.Date.format(start_date,'j F Y'), status),
            autoShow : true,
            closable : true,
            layout   : 'border',
            items    : [{ 
                xtype:  'tstimetable',
                region: 'center',
                layout: 'fit',
                weekStart: start_date,
                editable: false,
                listeners: {
                    scope: this,
                    gridReady: function() {
//                                    console.log('here');
                    }
                }
            },
            {
                xtype: 'container',
                region: 'south',
                layout: 'hbox',
                itemId: 'popup_selector_box',
                padding: 10,
                items: [
                    {xtype:'container',  flex: 1}
                ]
            }],
            listeners: {
                scope: this,
                boxready: function(popup) {
                    popup.down('#popup_selector_box').add({
                        xtype:'rallybutton', 
                        text:'Unlock',
                        disabled: (status != "Approved" || !this._currentUserCanUnlock()),
                        listeners: {
                            scope: this,
                            click: function() {
                                this._unlockTimesheet(record);
                                popup.close();
                            }
                        }
                    });
                    
                    popup.down('#popup_selector_box').add({
                        xtype:'rallybutton', 
                        text:'Approve',
                        disabled: (status == "Approved"),
                        listeners: {
                            scope: this,
                            click: function() {
                                this._approveTimesheet(record);
                                popup.close();
                            }
                        }
                    });
                }
            }
        });
    },
    
    _approveTimesheet: function(record) {
        record.approve();
    },
    
    _unlockTimesheet: function(record) {
        record.unlock();
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
