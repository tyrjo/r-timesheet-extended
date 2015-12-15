/**
 */
 
 Ext.define('Rally.technicalservices.TimeTable', {
    extend: 'Ext.Container',
    alias: 'widget.tstimetable',
    
    logger: new Rally.technicalservices.Logger(),

    /**
     * @property {String} cls The base class applied to this object's element
     */
    cls: "tstimetable",

    config: {
        weekStart: new Date()
    },
    
    constructor: function (config) {
        this.mergeConfig(config);
        
        this.callParent([this.config]);
    },

    initComponent: function () {
        var me = this;
        this.callParent(arguments);
        
        this.addEvents(
            /**
             * @event
             * Fires when the grid has been rendered
             * @param {Rally.technicalservices.TimeTable} this
             * @param {Rally.ui.grid.Grid} grid
             */
            'gridReady'
        );
        
        this.weekStart = this._getStartOfWeek(this.weekStart);
        this.logger.log("Week Start: ", this.weekStart);
        
        Rally.technicalservices.TimeModelBuilder.build('TimeEntryItem','TSTableRow').then({
            scope: this,
            success: function(model) {
//                Ext.Array.each(model.getFields(), function(field){
//                    console.log(' - ', field.name, field.type );
//                });
                
                var table_store = Ext.create('Rally.data.custom.Store',{
                    model: 'TSTableRow'
                });
                
                this._makeGrid(table_store);
                this._updateData();
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem creating model', msg);
            }
        });

    },
    
    _updateData: function() {
        this.setLoading('Loading time...');
        var store = this.down('rallygrid').getStore();
        
        store.removeAll(true);


        Deft.Chain.sequence([
            this._loadTimeEntryItems,
            this._loadTimeEntryValues
        ],this).then({
            scope: this,
            success: function(results) {
                var time_entry_items  = results[0];
                var time_entry_values = results[1];
                
                var rows = Ext.Array.map(time_entry_items, function(item){
                    var data = {
                        __TimeEntryItem:item
                    };
                    
                    return Ext.create('TSTableRow',Ext.Object.merge(data, item.getData()));
                });
                
                var rows = this._addTimeEntryValues(rows, time_entry_values);
                
                this.logger.log('TEIs:', time_entry_items);
                this.logger.log('Rows:', rows);

                store.loadRecords(rows);
                this.setLoading(false);
            }
        });
        
    },
    
    _addTimeEntryValues: function(rows, time_entry_values) {
        var rows_by_oid = {};
        
        Ext.Array.each(rows, function(row) { rows_by_oid[row.get('ObjectID')] = row; });
        
        Ext.Array.each(time_entry_values, function(value){
            var parent_oid = value.get('TimeEntryItem').ObjectID;

            var row = rows_by_oid[parent_oid];
            row.addTimeEntryValue(value);
        });
        
        return rows;
    },
    
    _loadTimeEntryItems: function() {
        this.setLoading('Loading time entry items...');

        var week_start = Rally.util.DateTime.toIsoString(this.weekStart,false).replace(/T.*$/,'T00:00:00.000Z');
        
        var config = {
            model: 'TimeEntryItem',
            context: {
                project: null
            },
            fetch: ['Project','WeekStartDate','WorkProductDisplayString','TaskDisplayString'],
            filters: [{property:'WeekStartDate',value:week_start}]
        };
        
        return this._loadWsapiRecords(config);
    },
    
    _loadTimeEntryValues: function() {
        this.setLoading('Loading time entry values...');
        var week_start = Rally.util.DateTime.toIsoString(this.weekStart,false).replace(/T.*$/,'T00:00:00.000Z');

        var config = {
            model: 'TimeEntryValue',
            context: {
                project: null
            },
            fetch: ['DateVal','Hours','TimeEntryItem','ObjectID'],
            filters: [{property:'TimeEntryItem.WeekStartDate',value:week_start}]
        };
        
        return this._loadWsapiRecords(config);
    },
    
    _makeGrid: function(table_store) {
        this.removeAll();
        
        var me = this;
        var columns = this._getColumns();
                
        this.grid = this.add({ 
            xtype:'rallygrid', 
            store: table_store,
            columnCfgs: columns,
            showPagingToolbar : false,
            showRowActionsColumn : false,
            sortableColumns: false,
            disableSelection: true,
            enableColumnMove: false,
            viewConfig: {
                listeners: {
                    scope: this,
                    itemupdate: function(row, row_index) {
                        me.logger.log('itemupdate', row);
                    }
                }
            }
        });
        
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        
        var final_config = Ext.Object.merge(default_config,config);
        this.logger.log("Starting load:",final_config.model);
          
        Ext.create('Rally.data.wsapi.Store', final_config).load({
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
    
    _getColumns: function(task_states) {
        var me = this;
                
        var columns = [
            {
                dataIndex: 'Project',
                text: 'Project',
                flex: 1,
                editor: null,
                renderer: function(v) {
                    return v._refObjectName;
                }
            },
            {
                dataIndex: 'WorkProductDisplayString',
                text:  'Work Product',
                flex: 1,
                editor: null
            },
            {
                dataIndex: 'TaskDisplayString',
                text:  'Task',
                flex: 1,
                editor: null
            }
        ];
        
        var day_width = 50;
        
        var editor_config = {
            xtype:'rallynumberfield',
            minValue: 0,
            maxValue: 24
        };
        
        columns.push({dataIndex:'__Sunday',   width: day_width, text:'Sun', editor: editor_config });
        columns.push({dataIndex:'__Monday',   width: day_width, text:'Mon', editor: editor_config });
        columns.push({dataIndex:'__Tuesday',  width: day_width, text:'Tue', editor: editor_config});
        columns.push({dataIndex:'__Wednesday',width: day_width, text:'Wed', editor: editor_config});
        columns.push({dataIndex:'__Thursday', width: day_width, text:'Thur', editor: editor_config});
        columns.push({dataIndex:'__Friday',   width: day_width, text:'Fri', editor: editor_config});
        columns.push({dataIndex:'__Saturday', width: day_width, text:'Sat', editor: editor_config});

        
        return columns;
    },
    
    /*
     * Given a date, return the beginning of the week
     */
    _getStartOfWeek: function(date_in_week,asIso){
        if ( typeof(date_in_week) == 'undefined' ) {
            date_in_week = new Date();
        }

        var day_of_week = date_in_week.getDay();
        var day_of_month = date_in_week.getDate();
        
        // determine what beginning of week is
        var start_of_week_js = date_in_week;
        start_of_week_js.setDate( day_of_month - day_of_week );
        
        // push to midnight
        start_of_week_js.setUTCHours(0,0,0,0);
        
        if ( asIso ) { 
            return Rally.util.DateTime.toIsoString(start_of_week_js,true);
        }

        return start_of_week_js;
    }

});
