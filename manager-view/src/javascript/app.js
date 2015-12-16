Ext.define("TSTimeSheetApproval", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }},
        {xtype:'container', itemId:'display_box' , region: 'center', layout: { type: 'fit'} }
    ],

    integrationHeaders : {
        name : "TSTimeSheetApproval"
    },
                        
    launch: function() {
        this._loadTimesheets().then({
            scope: this,
            success: function(timesheets) {
                this._addGrid(this.down('#display_box'), timesheets);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading users with timesheets', msg);
            }
        });
    },
    
    _loadTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred');
        this.setLoading("Loading stuff...");
        
        var config = {
            model:'TimeEntryItem',
            limit: 'Infinity',
            fetch: ['User','WeekStartDate','ObjectID', 'UserName','Values:summary[Hours]']
        };
        
        this._loadWsapiRecords(config).then({
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
                
                console.log(timesheets);
                
                deferred.resolve(Ext.Object.getValues(timesheets));
                
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
            sorters: [{property:'WeekStartDate'}],
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
            features: [{
                ftype: 'groupingsummary',
                groupHeaderTpl: '{name} ({rows.length})'
            }]
        });
    },
    
    _getColumns: function() {
        var columns = [];
        
        columns.push({dataIndex:'User',text:'User', renderer: function(v) { return v._refObjectName; }});
        columns.push({dataIndex:'WeekStartDate',text:'Week Starting', align: 'center', renderer: function(v) { return Ext.util.Format.date(v,'m/d/y'); }});
        columns.push({dataIndex:'__Hours',text:'Hours', align: 'center'});
        columns.push({dataIndex:'__Status',text:'Status', align: 'center'});
        
        return columns;
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
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
