Ext.define("TSFinanceReport", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
defaults: { margin: 10 },
    
    layout: 'border', 
    
    stateFilterValue: 'ALL',
    
    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }},
        {xtype:'container', itemId:'display_box' , region: 'center', layout: { type: 'fit'} }
    ],

    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',

    integrationHeaders : {
        name : "TSFinanceReport"
    },
    
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
                
        var date_container = container.add({
            xtype:'container',
            layout: 'vbox'
        });
        
        var week_start = this._getBeginningOfWeek(Rally.util.DateTime.add(new Date(), 'week', -4));
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'from_date_selector',
            fieldLabel: 'From',
            labelWidth: 50,
            value: week_start,
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    this._enableGoButton();
                }
            }
        });
        
        date_container.add({
            xtype:'rallydatefield',
            itemId:'to_date_selector',
            fieldLabel: 'Through',
            labelWidth: 50,
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    this._enableGoButton();
                }
            }
        }).setValue(new Date());
        
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
        
        var spacer = container.add({ xtype: 'container', flex: 1});
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: '<span class="icon-export"> </span>',
            disabled: false,
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            }
        });
        
        if ( this.isExternal() ) {
            container.add({type:'container', html: '......'});
        }
        
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
        this.down('#display_box').removeAll();
        var go_button = this.down('#go_button');
        
        go_button && go_button.setDisabled(true);
        
        
        Deft.Chain.pipeline([
            this._loadTimesheets,
            this._loadPreferences
        ],this).then({
            scope: this,
            success: function(timesheets) {
                var time_rows = this._getRowsFromTimesheets(timesheets);
                this._addGrid(this.down('#display_box'), time_rows);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        });
    },
    
    _loadTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        this.setLoading("Loading timesheets...");
        
        var tei_filters = [{property:'ObjectID', operator: '>', value: 0 }];
        var tev_filters = [{property:'ObjectID', operator: '>', value: 0 }];
        
        if (this.down('#from_date_selector') ) {
            var selector_start_date = this.down('#from_date_selector').getValue();
            var week_start_date = Rally.util.DateTime.add(selector_start_date, 'day', -6); // selector might be midweek, need this to get timesheets
            
            var tei_start_date = Rally.util.DateTime.toIsoString(week_start_date ,false).replace(/T.*$/,'T00:00:00.000Z');
            var tev_start_date = Rally.util.DateTime.toIsoString(selector_start_date ,false).replace(/T.*$/,'T00:00:00.000Z');
            tei_filters.push({property:'WeekStartDate', operator: '>=', value:tei_start_date});
            tev_filters.push({property:'DateVal', operator: '>=', value:tev_start_date});
        }
        
        if (this.down('#to_date_selector') ) {
            var start_date = Rally.util.DateTime.toIsoString( this.down('#to_date_selector').getValue(),true).replace(/T.*$/,'T00:00:00.000Z');
            tei_filters.push({property:'WeekStartDate', operator: '<=', value:start_date});
            tev_filters.push({property:'DateVal', operator: '<=', value:start_date});
        }
        
        var teitem_config = {
            model:'TimeEntryItem',
            limit: 'Infinity',
            filters: tei_filters,
            context: {
                project: null
            },
            fetch: ['WeekStartDate','ObjectID','UserName','Project','WorkProduct','WorkProductString',
                'User','OfficeLocation','NetworkID','c_EmployeeType','CostCenter'
            ]
        };
        
        var tevalue_config = {
            model:'TimeEntryValue',
            limit: 'Infinity',
            filters: tev_filters,
            context: {
                project: null
            },
            fetch: ['WeekStartDate','ObjectID','DateVal','Hours',
                'TimeEntryItem','WorkProduct', 'WorkProductDisplayString',
                'User','Project','Feature',
                'Release','c_DecommissionDate','State','c_DeploymentDate',
                'Task','TaskDisplayString','c_ActivityType','c_ProjectActivityType'
            ]
        };
        
        Deft.Chain.sequence([
            function() { return TSUtilities.loadWsapiRecordsWithParallelPages(teitem_config);  },
            function() { return TSUtilities.loadWsapiRecordsWithParallelPages(tevalue_config); }
        ],this).then({
            scope: this,
            success: function(results) {
                var time_entry_items  = results[0];
                var time_entry_values = results[1];
                
                var timesheets = this._getTimesheetsFromTimeEntryItems(time_entry_items);
                timesheets = this._addTimeValuesToTimeSheets(timesheets,time_entry_values);
                
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
        
        this.logger.log("_loadPreferences", timesheets);
        
        var stateFilter = this.stateFilterValue;
        
        var filters = [{property:'Name',operator:'contains',value:this._approvalKeyPrefix}];
        
        var config = {
            model:'Preference',
            limit: Infinity,
            filters: filters,
            fetch: ['Name','Value'],
            sorters: { property:'CreationDate', direction: 'ASC' }
        };
        
        TSUtilities._loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                var preferences_by_key = {};
                
                Ext.Array.each(preferences, function(pref){
                    var key_array = pref.get('Name').split('.');
                    if ( key_array.length > 6) {
                        key_array.pop();
                    }
                    preferences_by_key[key_array.join('.')] = pref;
                });
                
                Ext.Array.each(timesheets, function(timesheet){
                    var key = timesheet.getPreferenceKey();
                    if (preferences_by_key[key]) {
                        var status_object = Ext.JSON.decode(preferences_by_key[key].get('Value'));
                        timesheet.set('__Status', status_object.status || "Open");
                        timesheet.set('__LastUpdateBy', status_object.status_owner._refObjectName || "");
                        timesheet.set('__LastUpdateDate', status_object.status_date);
                        
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

    _getTimesheetsFromTimeEntryItems: function(time_entry_items) {
        var timesheets = { };
        Ext.Array.each(time_entry_items, function(item){
            var key = Ext.String.format("{0}_{1}",
                item.get('User').ObjectID,
                Rally.util.DateTime.toIsoString(item.get('WeekStartDate'))
            );
            
            if ( ! timesheets[key] ) {
                timesheets[key] = Ext.Object.merge( item.getData(), { 
                    __UserName: item.get('User').UserName,
                    __Hours: 0,
                    __Status: "Unknown",
                    __TimeEntryItems: []
                });
            }
            
            timesheets[key].__TimeEntryItems.push(item);
        },this);
        
        
        return timesheets;
    },
    
    _addTimeValuesToTimeSheets: function(timesheets,time_entry_values) {
        var time_entry_values_by_item_oid = {};
        
        Ext.Array.each(time_entry_values, function(value){
            var item_oid = value.get('TimeEntryItem').ObjectID;
            if ( Ext.isEmpty( time_entry_values_by_item_oid[item_oid] )) {
                time_entry_values_by_item_oid[item_oid] = [];
            }
            time_entry_values_by_item_oid[item_oid].push(value);
        });
        
        Ext.Object.each(timesheets, function(key,timesheet){
            var items = timesheet.__TimeEntryItems;
            var timesheet_values = timesheet.__TimeEntryValues;
            if ( Ext.isEmpty(timesheet_values) ) { timesheet_values = []; }
            
            Ext.Array.each(items, function(item){
                var item_oid = item.get('ObjectID');
                
                var values = time_entry_values_by_item_oid[item_oid];
                if (Ext.isArray(values)) {
                    timesheet_values = Ext.Array.push(timesheet_values,values);
                }
            });
            
            timesheet.__TimeEntryValues = timesheet_values;
        });
        
        return timesheets;
        
    },
    
    _getRowsFromTimesheets: function(timesheets){
        this.logger.log("timesheets", timesheets);
        
        var rows = [];
        Ext.Object.each(timesheets, function(key,timesheet){
            var time_values = timesheet.get('__TimeEntryValues');
            Ext.Array.each(time_values, function(time_value){
                var isOpEx = false;
                
                var product = time_value.get('TimeEntryItem').Project;
                var workproduct = time_value.get('TimeEntryItem').WorkProduct;
                var feature = null;
                var release = null;
                
                if ( !Ext.isEmpty(workproduct) && workproduct.Feature ) {
                    feature = workproduct.Feature;
                    product = feature.Project;
                }
                
                if ( !Ext.isEmpty(workproduct) && workproduct.Release ) {
                    release = workproduct.Release;
                }
                
                var task = time_value.get('TimeEntryItem').Task;
                if ( !Ext.isEmpty(task) ) {
                    if ( !Ext.isEmpty(task.c_ActivityType) && !/CapEx/.test(task.c_ActivityType) && !/^-/.test(task.c_ActivityType)) {
                        isOpEx = true;
                    }
                }
                
                if ( !Ext.isEmpty(workproduct)  ) {
                    if ( !Ext.isEmpty(workproduct.c_ActivityType) && !/CapEx/.test(workproduct.c_ActivityType) ) {
                        isOpEx = true;
                    }
                }
                
                if ( !Ext.isEmpty(feature) ) {
                    if ( !Ext.isEmpty(workproduct.c_ActivityType) && !/CapEx/.test(workproduct.c_ActivityType) ) {
                        isOpEx = true;
                    }
                }
                
                rows.push(Ext.Object.merge( time_value.getData(),{
                    WeekStartDate     : timesheet.get('WeekStartDate'),
                    User              : timesheet.get('User'),
                    __Location        : timesheet.get('User').OfficeLocation,
                    __AssociateID     : timesheet.get('User').NetworkID,
                    __EmployeeType    : timesheet.get('User').c_EmployeeType,
                    __CostCenter      : timesheet.get('User').CostCenter,
                    __Status          : timesheet.get('__Status'),
                    __LastUpdateBy    : timesheet.get('__LastUpdateBy'),
                    __LastUpdateDate  : timesheet.get('__LastUpdateDate'),
                    __Release         : release,
                    __Product         : product,
                    __IsOpEx          : isOpEx,
                    __WorkItem        : time_value.get('TimeEntryItem').WorkProduct,
                    __WorkItemDisplay : time_value.get('TimeEntryItem').WorkProductDisplayString,
                    __Task            : time_value.get('TimeEntryItem').Task,
                    __TaskDisplay     : time_value.get('TimeEntryItem').TaskDisplayString
                }));
                
            });
        });
        
        this.logger.log('rows', rows);
        
        return Ext.Array.map(rows, function(row){
            return Ext.create('TSTimesheetFinanceRow',row);
        });
    },
    
    _addGrid: function(container, timesheets) {
        this.logger.log('add grid', timesheets);
        
        var store = Ext.create('Rally.data.custom.Store',{
            data:timesheets,
            pageSize: 50000,
            model: 'TSTimesheetFinanceRow'
        });
        
        var columns = this._getColumns();
        
        container.add({
            xtype:'rallygrid',
            store: store,
            columnCfgs: columns,
            enableEditing: false,
            showRowActionsColumn: false,
            enableBulkEdit: false,
            showPagingToolbar: false
        });
    },
    
    _getColumns: function() {
        var columns = [];
        
        columns.push({dataIndex:'User',text:'User', renderer: function(v) { return v._refObjectName; }});
        columns.push({dataIndex:'__Location',text:'Location' });
        columns.push({dataIndex:'__AssociateID',text:'Associate ID' });
        columns.push({dataIndex:'__EmployeeType', text:'Employee Type' });
        columns.push({dataIndex:'__CostCenter', text:'Cost Center', exportRenderer: function(v) {
            return Ext.String.format('="{0}"', v);
        }});
        
        columns.push({dataIndex:'DateVal',text:'Work Date', align: 'center', renderer: function(v) {
            var offset = v.getTimezoneOffset();
            
            var week_date = v;
            //console.log(offset);  // 480 is pacific, -330 is india
            // datevals are set to the london midnight for that day, so shifting to pacific
            // will put Tuesday on Monday, but India will be fine for week day
            
            if ( offset > 0 ) {
                week_date = Rally.util.DateTime.add(v,'minute',offset);
            }
            
            var display_value = Ext.util.Format.date(week_date,'m/d/y');
            //console.log(v, week_date, display_value);
            
            return display_value;
        }});
        
        columns.push({dataIndex:'Hours',  text:'Actual Hours', align: 'right'});
        columns.push({dataIndex:'__Status', text:'Status', align: 'center'});
        columns.push({dataIndex:'__LastUpdateBy', text:'Status Set By', align: 'center'});
        columns.push({dataIndex:'__LastUpdateDate', text:'Status Set On', align: 'center'});
        
        columns.push({dataIndex:'__WorkItemDisplay',text:'Work Item', align: 'center'});
        columns.push({dataIndex:'__Task',text:'Category', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.c_ActivityType) ) { return ""; }
            return v.c_ActivityType;
        }});
        
        columns.push({dataIndex:'__Release',text:'Release', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) ) { return ""; }
            return v._refObjectName;
        }});
        
        columns.push({dataIndex:'__Release',text:'Release Status', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.State) ) { return ""; }
            return v.State;
        }});
        columns.push({dataIndex:'__Release',text:'Decommission Date', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.c_DecommissionDate) ) { return ""; }
            return v.c_DecommissionDate;
        }});
        columns.push({dataIndex:'__Release',text:'Deployment Date', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) || Ext.isEmpty(v.c_DeploymentDate) ) { return ""; }
            return v.c_DeploymentDate;
        }});
        
        columns.push({dataIndex:'__Product',text:'Product', align: 'center', renderer: function(v){ return v._refObjectName; }});
        columns.push({dataIndex:'__WorkItem',text:'Work Item Project', align: 'center', renderer: function(v) {
            if ( Ext.isEmpty(v) ) {
                return "";
            }
            
            return v.Project._refObjectName;
        }});
        
        columns.push({dataIndex: '__IsOpEx', text: 'OpEx', align: 'center'});
        
        columns.push({dataIndex: '___WeekNumber', text: 'Week Number', align: 'center'});
        
        return columns;
    },
    
    _getBeginningOfWeek: function(js_date){
        var start_of_week_here = Ext.Date.add(js_date, Ext.Date.DAY, -1 * js_date.getDay());
        return start_of_week_here;
    },
//    
//    getOptions: function() {
//        return [
//            {
//                text: 'About...',
//                handler: this._launchInfo,
//                scope: this
//            }
//        ];
//    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;
        
        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('project-report.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
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
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
