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

    _commentKeyPrefix: 'rally.technicalservices.timesheet.comment',

    integrationHeaders : {
        name : "TSTimeSheetApproval"
    },
    
    stateFilterValue: 'Open',
    
    config: {
        defaultSettings: {
            managerField: 'DisplayName',
            showAllForAdmins: true,
            preferenceProjectRef: '/project/51712374295'
        }
    },
    
    launch: function() {
        var preference_project_ref = this.getSetting('preferenceProjectRef');
        if ( !  TSUtilities.isEditableProjectForCurrentUser(preference_project_ref,this) ) {
            Ext.Msg.alert('Contact your Administrator', 'This app requires editor access to the preference project.');
        } else {
            this._addSelectors(this.down('#selector_box'));
        }
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
                        var grid = this.down('rallygrid');
                        if ( grid ) {
                            grid.getView().features[0].collapseAll();
                        }
                    } else {
                        button.expanded = true;
                        button.setText('<span class="icon-collapseall"> </span>');
                        var grid = this.down('rallygrid');
                        if ( grid ) {
                            grid.getView().features[0].expandAll();
                        }
                    }
                }
            }
        });
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            cls: 'secondary',
            text: '<span class="icon-export"> </span>',
            disabled: true,
            listeners: {
                scope: this,
                click: function() {
                    this._export();
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

        container.add({xtype:'container',flex: 1});
        
        container.add({
            xtype:'combobox',
            value: this.stateFilterValue,
            fieldLabel: 'Timesheet State:',
            store: state_store,
            queryMode: 'local',
            displayField: 'displayName',
            valueField: 'value',
            margin: 10,
            width: 200,
            listeners: {
                scope: this,
                change: function(cb) {
                    this.stateFilterValue = cb.getValue();
                    this._enableGoButton();
                }
            }
        });
        
        var date_container = container.add({
            xtype:'container',
            layout: 'vbox',
            margin: 3
        });
        
        var week_start = Rally.util.DateTime.add(new Date(), 'week', -4);
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'from_date_selector',
            fieldLabel: 'From Week',
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = TSDateUtils.getBeginningOfWeekForLocalDate(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                    this._enableGoButton();
                }
            }
        }).setValue(week_start)
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'to_date_selector',
            fieldLabel: 'Through Week',
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = TSDateUtils.getBeginningOfWeekForLocalDate(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                    this._enableGoButton();
                }
            }
        }).setValue(Rally.util.DateTime.add(new Date(), 'week', -1));
        
        container.add({
            xtype:'rallybutton',
            itemId: 'go_button',
            text:'Go',
            margin: '15 3 3 3',
            disabled: false,
            listeners: {
                scope: this,
                click: this._updateData
            }
        });
        
        container.add({xtype:'container',flex: 1});

        //if ( this.isExternal() ) {
            container.add({type:'container', html: '&nbsp;&nbsp;&nbsp;', border: 0, padding: 10});
        //}
        
    },
    
    _enableGoButton: function() {
        var start_calendar = this.down('#from_date_selector');
        var to_calendar    = this.down('#to_date_selector');
        
        var go_button = this.down('#go_button');
        
        go_button && go_button.setDisabled(true);
        
        if ( start_calendar && to_calendar ) {
            go_button && go_button.setDisabled(false);
        }
    },
    
    _updateData: function() {
        var me = this;
        this.down('#display_box').removeAll();
        this.down('#go_button').setDisabled(true);
        
        this.startDate = this.down('#from_date_selector').getValue();
        this.endDate   = this.down('#to_date_selector').getValue();
        
        if ( this.pipeline && this.pipeline.getState() === 'pending' ) {
            this.pipeline.cancel();
        }
        
        this.pipeline = Deft.Chain.pipeline([
            this._loadTimesheets,
            this._loadPreferences,
            this._loadComments
        ],this);
        
        this.pipeline.then({
            scope: this,
            success: function(timesheets) {
                this._addGrid(this.down('#display_box'), timesheets);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        }).always(function() { me.setLoading(false); });
    },
    
    _loadTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading timesheets...");
        
        var filters = [
            // TODO (tj) Removed until required
            //{property:'User.NoTimesheet', value: false },
            {property:'User.Disabled', value: false }
        ];
        
        if (this.down('#from_date_selector') ) {
            var start_date = TSDateUtils.getBeginningOfWeekISOForLocalDate(this.startDate,true);
            filters.push({property:'WeekStartDate', operator: '>=', value:start_date});
        }
        
        if (this.down('#to_date_selector') ) {
            var start_date = TSDateUtils.getBeginningOfWeekISOForLocalDate(this.endDate,true);
            filters.push({property:'WeekStartDate', operator: '<=', value:start_date});
        }
        
        console.log('IsAdmin:', TSUtilities.currentUserIsAdmin());
        
        if ( ! this.getSetting('showAllForAdmins') || !TSUtilities.currentUserIsAdmin() ){
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
            fetch: ['User','WeekStartDate','ObjectID', 'UserName','Values:summary[Hours]', this.getSetting('managerField')]
        };
        
        TSUtilities.loadWsapiRecords(config).then({
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
        
        var filters = [
            {property:'Name',operator:'contains',value:TSUtilities.approvalKeyPrefix},
            {property:'Name',operator:'!contains',value: TSUtilities.archiveSuffix}
        ];
        
        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: filters,
            fetch: ['Name','Value'],
            sorters: [{property:'CreationDate',direction:'ASC'}]
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                this.logger.log("Applying preferences", preferences);
                var preferences_by_key = {};
                
                Ext.Array.each(preferences, function(pref){
                    var pref_name_array = pref.get('Name').split('.');
                    pref_name_array.pop();
                    
                    preferences_by_key[pref_name_array.join('.')] = pref;
                });
                
                this.logger.log('Preferences by Key', preferences_by_key);
                
                Ext.Array.each(timesheets, function(timesheet){
                    var key = timesheet.getShortPreferenceKey();

                    if (preferences_by_key[key]) {
                        var value = preferences_by_key[key].get('Value');
                        var status_object = {};
                        if ( /{/.test(value) ) {
                            status_object = Ext.JSON.decode(value);
                        } else {
                            status_object = {
                                status: value,
                                status_owner: { _refObjectName: '' }
                            }
                        }

                        timesheet.set('__Status', status_object.status || "Open");
                        timesheet.set('__LastUpdateBy', status_object.status_owner._refObjectName || "");

                    } else { 
                        timesheet.set('__Status', 'Open');
                    }
                },this);
                                
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
    
    _loadComments: function(timesheets) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        this.setLoading("Loading comments...");

        var timesheets_by_key = {};
        
        var filters = Ext.Array.map(timesheets, function(timesheet){
            var comment_key = Ext.String.format("{0}.{1}.{2}", 
                me._commentKeyPrefix,
                TSDateUtils.formatShiftedDate(timesheet.get('WeekStartDate'),'Y-m-d'),
                timesheet.get('User').ObjectID
            );
            
            timesheets_by_key[comment_key] = timesheet;
            
            return { property:'Name',operator: 'contains', value:comment_key };
        });
        
        var promises = [];
        
        Ext.Array.each(filters, function(filter){
            var config = {
                model:'Preference',
                limit: 'Infinity',
                filters: [filter],
                fetch: ['Name','Value'],
                context: {
                    project: null
                }
            };
            
            promises.push( function() { return TSUtilities.loadWsapiRecords(config); } );
        });
        
        CA.techservices.promise.ParallelThrottle.throttle(promises, 6, me).then({
                success: function(results){
                    var comments = Ext.Array.flatten(results);
                    
                    Ext.Array.each(comments, function(comment){
                        var name_array = comment.get('Name').split(/\./);
                        name_array.pop();
                        var key = name_array.join('.');
                                                
                        var timesheet = timesheets_by_key[key];
                        if ( Ext.isEmpty(timesheet) ) { 
                            me.logger.log('skip ', key);
                            return;
                        }
                                                
                        var timesheet_comments = timesheet.get('__Comments');
                        if ( Ext.isEmpty(timesheet_comments) ) {
                            timesheet_comments = [];
                        }
                        timesheet_comments.push(comment);
                        timesheet.set('__Comments', timesheet_comments);
                    });
                    
                    deferred.resolve( Ext.Object.getValues(timesheets_by_key) );
                },
                failure: function(msg) {
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
        this.logger.log("_addGrid",timesheets);
        
        var store = Ext.create('Rally.data.custom.Store',{
            data:timesheets,
            groupField: 'User',
            groupDir: 'ASC',
            pageSize: 50000,
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
            showPagingToolbar: false,
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
                },
                viewready: function() {
                    this.down('#export_button') && this.down('#export_button').setDisabled(false);
                },
                destroy: function() {
                    this.down('#export_button') && this.down('#export_button').setDisabled(true);
                }
            }
        });
    },
    
    _getColumns: function() {
        var me = this;
        var columns = [{
            xtype: 'tsrowactioncolumn',
            canUnapprove: TSUtilities._currentUserCanUnapprove()
        }];
        
        columns.push({
            dataIndex:'User',
            text:'User',
            renderer: function(v) { return v._refObjectName || value.UserName; }
        });
        columns.push({dataIndex:'WeekStartDate',text:'Week Starting', align: 'center', renderer: function(v) { 
            return TSDateUtils.formatShiftedDate(v, 'm/d/y'); 
        }});
        columns.push({
            dataIndex:'__Hours',
            text:'Hours', 
            align: 'center',
            renderer: me._renderColor
        });
        columns.push({dataIndex:'__Status',text:'Status', align: 'center'});
        columns.push({dataIndex:'__LastUpdateBy',text:'Status Changed By', align: 'center'});
        
        columns.push({dataIndex:'User', text:'Manager', align: 'center',
            renderer: function(v) { 
                return v[me.getSetting('managerField')] || "none"; 
            } 
        });
        
        columns.push({dataIndex: '__Comments', text: "Comments", align: 'center',
            renderer: function(v) {
                if ( Ext.isEmpty(v) ) { return 0; }
                if ( !Ext.isArray(v) ) { return 0; }
                return v.length;
            }
        });
        return columns;
    },
    
    _popup: function(record){
        var user_name = record.get('User')._refObjectName;
        var status = record.get('__Status');
        this.logger.log("_popup", user_name, status, record);
                
        Ext.create('Rally.technicalservices.ManagerDetailDialog', {
            id       : 'popup',
            width    : Ext.getBody().getWidth() - 150,
            height   : Ext.getBody().getHeight() - 150,
            title    : Ext.String.format("{0}: {1} ({2})", 
                user_name, 
                TSDateUtils.formatShiftedDate(record.get('WeekStartDate'),'j F Y'), 
                status
            ),
            autoShow : true,
            autoCenter: true,
            closable : true,
            commentKeyPrefix: this._commentKeyPrefix,
            record   : record,
            manager_field: this.getSetting('managerField')
        });
    },
    
//    getOptions: function() {
//        return [
//            {
//                text: 'About...',
//                handler: this._launchInfo,
//                scope: this
//            }
//        ];
//    },
    
    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;
        
        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = 'manager-time-report.csv';

        this.setLoading("Generating CSV");
        
        var promises = [];
        
        this.logger.log('before selected list');
        var selected = grid.getSelectionModel().getSelection();
        this.logger.log('selected', selected);
        
        if ( !selected || selected.length == 0 ){
            this.logger.log('export selected items');
            promises.push(function() {return Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid) });
        }
        
        Ext.Array.each(selected, function(item, idx){
            promises.push(function(){ 
                return me._getCSVFromTimesheet(item,(idx > 0) ); 
            });
        });
                
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(results){
                this.logger.log('got csv', results);
                
                var csv = results.join('\r\n');
                
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    },
    
    _getCSVFromTimesheet: function(timesheet,skip_headers) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;

        this.logger.log('_getCSVFromTimesheet', timesheet, skip_headers);
        
        var status = timesheet.get('__Status');
                    
        var timetable = Ext.create('Rally.technicalservices.TimeTable',{
            startDate: timesheet.get('WeekStartDate'),
            editable: false,
            timesheet_status: timesheet.get('__Status'),
            timesheet_user: timesheet.get('User'),
            listeners: {
                scope: this,
                gridReady: function(timetable, grid) {
                    if ( grid.getStore().isLoading() ) {
                        grid.getStore().on('load', function() {
                            deferred.resolve(Rally.technicalservices.FileUtilities.getCSVFromGrid(me,grid,skip_headers));
                        }, this, { single: true });
                    } else {
                        deferred.resolve(Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid,skip_headers));
                    }
                }
            }
        });
        
        return deferred.promise;
    },
    
    _renderColor: function(value,metaData,record) {
        var white = "#ffffff";
        var red = '#fec6cd';
        var yellow = '#ffffcc';
        var orange ='#FF9933';
        var grey = '#D0D0D0';
        var color = grey;
       
        if ( value >= 40 && value < 67.51 ) {
            color = white;
        }
        if ( value < 40) {
            color = yellow;
        }
        
        console.log(record);
        var record_week_start = TSDateUtils.getBeginningOfWeekISOForLocalDate(record.get('WeekStartDate'));
        var current_week_start = TSDateUtils.getBeginningOfWeekISOForLocalDate(new Date());
        
        console.log('comparing', record_week_start, current_week_start);
        
        if ( record_week_start < current_week_start && value < 40 ) {
            color = red;
        }

        metaData.style = "background-color: " + color;
        return value;
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
            name: 'showAllForAdmins',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: '0 0 25 10',
            boxLabel: 'Show All<br/><span style="color:#999999;"><i>Tick to show all timesheets regardless of manager for admins.</i></span>'
        },{
            name: 'preferenceProjectRef',
            xtype:'rallyprojectpicker',
            fieldLabel: 'Preference Project',
            workspace: this.getContext().getWorkspaceRef(),
            showMostRecentlyUsedProjects : false,
            autoExpand: true,
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10
        },
        {
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
