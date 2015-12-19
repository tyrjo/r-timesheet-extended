Ext.define('Rally.technicalservices.ApproveMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsapprovemenuitem',


    config: {
        text: 'Approve',
        cls : 'icon-check'
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this._isApprovable;
        config.handler   = config.handler || this._approveRecord;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    _isApprovable: function(record) {
        return ( record.get('__Status') && record.get('__Status') != "Approved" );
    },
    
    _approveRecord: function() {
        var record = this.record;
        if ( !record ) {
            Ext.Msg.alert("Problem approving record", "Can't find record");
            return;
        }
        
        record.approve();
    }
});