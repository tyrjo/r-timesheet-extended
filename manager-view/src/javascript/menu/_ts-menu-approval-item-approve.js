Ext.define('Rally.technicalservices.ApproveMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsapprovemenuitem',


    config: {
        text: 'Approve',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._approveRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {

        if ( this.records && this.records.length > 0 ) {
            var should_show = true;
            Ext.Array.each(this.records, function(r){
                if ( !this._isApprovable(r) ) {
                    should_show = false;
                }
            },this);
            return should_show;
        }
        return this._isApprovable(record);
    },
    
    _isApprovable: function(record) {
        return ( record.get('__Status') && record.get('__Status') != "Approved" );
    },
    
    _approveRecord: function(record) {
        if ( !record ) {
            Ext.Msg.alert("Problem approving record", "Can't find record");
            return;
        }
        
        record.approve();
    },
    
    _approveRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._approveRecord(record);
        },this);
    }
});