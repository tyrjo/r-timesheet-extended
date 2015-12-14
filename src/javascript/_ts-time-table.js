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
        
        Rally.technicalservices.TimeModelBuilder.build('TimeEntryItem','TSTableRow').then({
            scope: this,
            success: function(model) {
                this.logger.log('new model', model.getFields());
                var table_store = Ext.create('Rally.data.custom.Store',{
                    model: 'TSTableRow'
                });
                
                this._makeGrid(table_store);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem creating model', msg);
            }
        });

                
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
                    itemupdate: function(row) {
                        me.logger.log('itemupdate', row);
                    }
                }
            }
        });
        
    },
    
    _getColumns: function(task_states) {
        var me = this;
                
        var columns = [{
            dataIndex: 'Project',
            text: 'Project',
            flex: 1
        }];
        
        columns.push({dataIndex:'__Sunday',   text:'Sun'});
        columns.push({dataIndex:'__Monday',   text:'Mon'});
        columns.push({dataIndex:'__Tuesday',  text:'Tue'});
        columns.push({dataIndex:'__Wednesday',text:'Wed'});
        columns.push({dataIndex:'__Thursday', text:'Thur'});
        columns.push({dataIndex:'__Friday',   text:'Fri'});
        columns.push({dataIndex:'__Saturday', text:'Sat'});

        
        return columns;
    }

});
