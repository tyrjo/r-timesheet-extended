Ext.define("TSAdmin", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    
    defaults: { margin: 5 },

    layout: { type: 'border' },

    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }, minHeight: 25},
        {xtype:'container',itemId:'display_box', region: 'center'}
    ],

    integrationHeaders : {
        name : "TSAdmin"
    },
    
    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',
    _timeLockKeyPrefix: 'rally.technicalservices.timesheet.weeklock',
    
    launch: function() {
        var me = this;
        this._addSelectors(this.down('#selector_box'));
        this._updateData();
    },
    
    _addSelectors: function(container) {
        container.add({
            xtype:'rallybutton',
            text: '+<span class="icon-lock"> </span>',
            toolTipText: "Add Week to Lock", 
            padding: 5,
            disabled: false,
            listeners: {
                scope: this,
                click: this._addWeekToLock
            }
        });
    },
    
    _updateData: function() {
        var display_box = this.down('#display_box');
        display_box.removeAll();
        
        this._loadPreferences().then({
            scope: this,
            success: function(locked_weeks) {
                this._addGrid(display_box, locked_weeks);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading preferences', msg);
            }
        });
    },
    
    _loadPreferences: function() {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading statuses...");
        
        var filters = [
            {property:'Name',operator:'contains',value:this._timeLockKeyPrefix}
        ];
        
        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: filters,
            fetch: ['Name','Value'],
            sorters: [{property:'CreationDate', direction:'ASC'}]
        };
        
        TSUtilities._loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                var statuses =  Ext.Array.map(preferences, function(preference){
                    var status_object = Ext.JSON.decode(preference.get('Value'));
                    
                    var status = Ext.create('TSLockedWeek',{
                        '__Status': status_object.status,
                        'WeekStartDate': status_object.week_start,
                        '__LastUpdateBy': status_object.status_owner,
                        '__LastUpdateDate': status_object.status_date,
                        'Preference': preference
                    });
                    return status;
                });
                
                var unique_statuses = this._keepNewestStatus(statuses);
              
                this.setLoading(false);
                deferred.resolve(unique_statuses);
                
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _keepNewestStatus: function(statuses) {
        var statuses_by_week_start = {};
        Ext.Array.each(statuses, function(status) {
            statuses_by_week_start[status.get('WeekStartDate')] = status;
        });
        
        return Ext.Object.getValues(statuses_by_week_start);
    },
    
    _addGrid: function(container, locked_weeks) {
        var store = Ext.create('Rally.data.custom.Store', {
            data: locked_weeks,
            model: 'TSLockedWeek',
            sorters: [{property:'WeekStartDate', direction:'DESC'}]
        });
        
        container.add({
            xtype:'rallygrid',
            store: store,
            columnCfgs: this._getColumns(),
            enableEditing: false,
            showRowActionsColumn: false,
            enableBulkEdit: false,
            showPagingToolbar: false,
            _recordIsSelectable: function(record) {
                return true;
            }
        });
    },
    
    _getColumns: function() {
        var columns = [];
        columns.push({
            xtype: 'tscommentrowactioncolumn',
            rowActionsFn: function(record,view) {
                if ( record && record.get('__Status') == 'Locked' ) {
                    return [{
                        text: 'Unlock', 
                        record: record, 
                        view: view,
                        handler: function(){
                            var item = this.record;
                            item.unlock();
                        }
                    }];
                } else if ( record && record.get('__Status') == "Unlocked" ) {
                    return [{
                        text: 'Lock', 
                        record: record, 
                        view: view,
                        handler: function(){
                            var item = this.record;
                            item.lock();
                        }
                    }]
                }
            }
        });
                
        return Ext.Array.merge(columns, [
            {dataIndex: 'WeekStartDate', text:'Week of', renderer: function(value) {
                var start_date = value;
                start_date = new Date(start_date.getUTCFullYear(), 
                    start_date.getUTCMonth(), 
                    start_date.getUTCDate(),  
                    start_date.getUTCHours(), 
                    start_date.getUTCMinutes(), 
                    start_date.getUTCSeconds());
                return Ext.util.Format.date(start_date,'n/j/Y');
            }},
            {dataIndex: '__Status', text: 'Status'},
            {dataIndex: '__LastUpdateBy', text: 'Changed by', renderer: function(value, meta, record) {
                return value._refObjectName;
            }}
        ]);
    },
    
    _addWeekToLock: function() {
        Ext.create('Rally.technicalservices.WeekChooserDialog', {
            autoShow: true,
            multiple: true,
            title: 'Choose Week',
            listeners: {
                weekchosen: function(dialog, chosen_weeks){
                    if ( !Ext.isArray(chosen_weeks) ) {
                        chosen_weeks = [chosen_weeks];
                    }
                    
                    Ext.Array.each(chosen_weeks, function(chosen_week){
                        this._addRowForItem(chosen_week);
                    },this);
                },
                scope: this
            }
         });
    },
    
    _addRowForItem: function(chosen_week) {
        
        var week = Ext.create('TSLockedWeek',{
            '__Status': "Locked",
            'WeekStartDate': this._getStartOfWeek( chosen_week )
        });
        
        week.lock().then({
            scope: this,
            success: this._updateData
        });
        
    },
    
    _getStartOfWeek: function(date_in_week){
        if ( typeof(date_in_week) == 'undefined' ) {
            date_in_week = new Date();
        }

        var day_of_week = date_in_week.getDay();
        var day_of_month = date_in_week.getDate();
        
        // determine what beginning of week is
        var start_of_week_js = date_in_week;
        start_of_week_js.setUTCDate( day_of_month - day_of_week );
        
        return Rally.util.DateTime.toIsoString(start_of_week_js,true).replace(/T.*$/,'');
       
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
