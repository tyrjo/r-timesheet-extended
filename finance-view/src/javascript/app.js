Ext.define("TSFinanceReport", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
defaults: { margin: 10 },
    
    layout: 'border', 
    
    stateFilterValue: 'Approved',
    
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
                var time_rows = this._getRowsFromTimesheets(timesheets);
                this._addGrid(this.down('#display_box'), time_rows);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        });
    },
    
    _loadTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading timesheets...");
        
        var tei_filters = [{property:'ObjectID', operator: '>', value: 0 }];
        var tev_filters = [{property:'ObjectID', operator: '>', value: 0 }];
        
        if (this.down('#from_date_selector') ) {
            var start_date = Rally.util.DateTime.toIsoString( this.down('#from_date_selector').getValue(),false).replace(/T.*$/,'T00:00:00.000Z');
            tei_filters.push({property:'WeekStartDate', operator: '>=', value:start_date});
            tev_filters.push({property:'TimeEntryItem.WeekStartDate', operator: '>=', value:start_date});
        }
        
        if (this.down('#to_date_selector') ) {
            var start_date = Rally.util.DateTime.toIsoString( this.down('#to_date_selector').getValue(),true).replace(/T.*$/,'T00:00:00.000Z');
            tei_filters.push({property:'WeekStartDate', operator: '<=', value:start_date});
            tev_filters.push({property:'TimeEntryItem.WeekStartDate', operator: '<=', value:start_date});
        }
        
        var teitem_config = {
            model:'TimeEntryItem',
            limit: 'Infinity',
            filters: tei_filters,
            context: {
                project: null
            },
            fetch: ['WeekStartDate','ObjectID','UserName','Project','WorkProduct','WorkProductString',
                'User','OfficeLocation','NetworkID'
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
                'User'
            ]
        };
        
        Deft.Chain.sequence([
            function() { return TSUtilities._loadWsapiRecords(teitem_config);  },
            function() { return TSUtilities._loadWsapiRecords(tevalue_config); }
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

    _getTimesheetsFromTimeEntryItems: function(time_entry_items) {
        var timesheets = { };
        Ext.Array.each(time_entry_items, function(item){
            var key = Ext.String.format("{0}_{1}",
                item.get('User').ObjectID,
                Rally.util.DateTime.toIsoString(item.get('WeekStartDate'))
            );
            if ( item.get('User').ObjectID == 17355928895 ) {
                console.log(key, item);
            }
            
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
        
        console.log('timesheets:', timesheets);
        
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
                
                rows.push(Ext.Object.merge( time_value.getData(),{
                    WeekStartDate     : timesheet.get('WeekStartDate'),
                    User              : timesheet.get('User'),
                    __Location        : timesheet.get('User').OfficeLocation,
                    __AssociateID     : timesheet.get('User').NetworkID,
                    __WorkItem        : time_value.get('TimeEntryItem').WorkProduct,
                    __WorkItemDisplay : time_value.get('TimeEntryItem').WorkProductDisplayString
                }));
            });
        });
        
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
                    
        columns.push({dataIndex:'DateVal',text:'Work Date', align: 'center', renderer: function(v) { return Ext.util.Format.date(v,'m/d/y'); }});
        columns.push({dataIndex:'Hours',  text:'Actual Hours', align: 'right'});
        columns.push({dataIndex:'__WorkItemDisplay',text:'Work Item', align: 'center'});
        
        return columns;
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
