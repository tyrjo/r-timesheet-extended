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
    
    stateFilterValue: 'Approved',
    
    config: {
        defaultSettings: {
            managerField: 'DisplayName'
        }
    },
    
    launch: function() {
        this._addSelectors(this.down('#selector_box'));
    },
    
    _addSelectors: function(container) {
        container.removeAll();
        
        container.add({
            xtype:'rallybutton',
            cls: 'secondary',
            text: '<span class="icon-expandall"> </span>',
            expanded: false,
            listeners: {
                scope: this,
                click: function(button) {
                    if ( button.expanded == true ) {
                        button.expanded = false;
                        button.setText('<span class="icon-expandall"> </span>');
                        console.log(this.down('rallygrid'));
                        
                        this.down('rallygrid').getView().features[0].collapseAll();
                    } else {
                        button.expanded = true;
                        button.setText('<span class="icon-collapseall"> </span>');
                        this.down('rallygrid').getView().features[0].expandAll();
                    }
                }
            }
        });
        
        var state_store = Ext.create('Ext.data.Store',{
            fields: ['displayName','value'],
            data: [
                {displayName:'All',  value:'ALL'},
                {displayName:'Open', value:'Open'},
                {displayName:'Approved', value:'Approved'}
            ]
        });
        
        container.add({
            xtype:'combobox',
            value: this.stateFilterValue,
            fieldLabel: 'Timesheet State:',
            store: state_store,
            queryMode: 'local',
            displayField: 'displayName',
            valueField: 'value',
            listeners: {
                scope: this,
                change: function(cb) {
                    this.stateFilterValue = cb.getValue();
                    this._updateData();
                }
            }
        });
        
        container.add({xtype:'container',flex: 1});
        
        var date_container = container.add({
            xtype:'container',
            layout: 'vbox'
        });
        
        var week_start = this._getBeginningOfWeek(Rally.util.DateTime.add(new Date(), 'week', -4));
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'from_date_selector',
            fieldLabel: 'From Week',
            value: week_start,
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = this._getBeginningOfWeek(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                    if ( new_value.getDay() === 0 ) {
                        this._updateData();
                    }
                }
            }
        });
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'to_date_selector',
            fieldLabel: 'Through Week',
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = this._getBeginningOfWeek(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                    if ( new_value.getDay() === 0 ) {
                        this._updateData();
                    }
                }
            }
        }).setValue(new Date());
        
        if ( this.isExternal() ) {
            container.add({type:'container', html: '......'});
        }
        
    },
    
    _updateData: function() {
        this.down('#display_box').removeAll();
        
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
        
        var filters = [{property:'ObjectID', operator: '>', value: 0 }];
        
        if (this.down('#from_date_selector') ) {
            var start_date = Rally.util.DateTime.toIsoString( this.down('#from_date_selector').getValue(),false).replace(/T.*$/,'T00:00:00.000Z');
            filters.push({property:'WeekStartDate', operator: '>=', value:start_date});
        }
        
        if (this.down('#to_date_selector') ) {
            var start_date = Rally.util.DateTime.toIsoString( this.down('#to_date_selector').getValue(),true).replace(/T.*$/,'T00:00:00.000Z');
            filters.push({property:'WeekStartDate', operator: '<=', value:start_date});
        }
        
        if ( ! this._currentUserCanUnlock() ) {
            var current_user_name = this.getContext().getUser().UserName;
            filters.push({property:'User.' + this.getSetting('managerField'), value: current_user_name});
        }
        
        var config = {
            model:'TimeEntryItem',
            limit: 'Infinity',
            filters: filters,
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
        var stateFilter = this.stateFilterValue;
        
        var filters = [{property:'Name',operator:'contains',value:this._approvalKeyPrefix}];
        
        // Open might be because there hasn't been a preference created yet
        if ( stateFilter && stateFilter != "ALL" && stateFilter != "Open" ) {
            filters.push({property:'Value', operator:'contains', value:stateFilter});
        }
        
        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: filters,
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
                
                var filtered_timesheets = Ext.Array.filter(timesheets, function(timesheet){
                    if (stateFilter == "ALL") {
                        return true;
                    }
                    
                    return ( timesheet.get('__Status') == stateFilter );
                });
                
                this.setLoading(false);
                deferred.resolve(filtered_timesheets);
                
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
                startCollapsed: true,
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
    
    _getBeginningOfWeek: function(js_date){
        var start_of_week_here = Ext.Date.add(js_date, Ext.Date.DAY, -1 * js_date.getDay());
        return start_of_week_here;
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
    
    _filterOutExceptStrings: function(store) {
        var app = Rally.getApp();
        app.logger.log('_filterOutExceptChoices');
        
        store.filter([{
            filterFn:function(field){ 
                var attribute_definition = field.get('fieldDefinition').attributeDefinition;
                var attribute_type = null;
                if ( attribute_definition ) {
                    attribute_type = attribute_definition.AttributeType;
                }
                if (  attribute_type == "BOOLEAN" ) {
                    return false;
                }
                if ( attribute_type == "STRING") {
                    if ( !field.get('fieldDefinition').attributeDefinition.Constrained ) {
                        return true;
                    }
                }
                return false;
            } 
        }]);
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [{
            name: 'managerField',
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'User Manager Field',
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10,
            autoExpand: false,
            alwaysExpanded: false,
            model: 'User',
            listeners: {
                ready: function(field_box) {
                    me._filterOutExceptStrings(field_box.getStore());
                }
            },
            readyEvent: 'ready'
        }];
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
