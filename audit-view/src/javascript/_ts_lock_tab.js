Ext.define('Rally.technicalservices.LockHistoryTab',{
    extend: 'Ext.panel.Panel',
    alias : 'widget.tslockhistorytab',
    
    initComponent: function() {
        this.callParent();
        
        //this.add(this._getGridConfig());
    },
    
    updateContent: function(app) {
        this.app = app;
        
    },
    
    _getGridConfig: function() {
        return {
            xtype                : 'rallygrid',
            sortableColumns      : false,
            showRowActionsColumn : false,
            showPagingToolbar    : false,
            columnCfgs           : this._getColumns(),
            store                : Ext.create('Rally.data.custom.Store', this._getStoreConfig())
        }
    },
    
    _getColumns: function() {
        var columns = [];
        
        columns.push({dataIndex:'Name',text:'Name'});
        
        return columns;
    },
    
    _getStoreConfig: function() {
        return {
            data: [{ 
                Name: ''
            }]
        }
    }
});