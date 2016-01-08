Ext.define('Rally.technicalservices.UnlockMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsunapprovemenuitem',


    config: {
        text: 'Unapprove',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._unapproveRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        if ( this.records && this.records.length > 0 ) {
            var should_show = true;
            Ext.Array.each(this.records, function(r){
                if ( !this._isUnapprovable(r) ) {
                    should_show = false;
                }
            },this);
            return should_show;
        }
        return this._isUnapprovable(record);
    },
    
    _isUnapprovable: function(record) {
        return ( record.get('__Status') && record.get('__Status') == "Approved" );
    },
    
    _unapproveRecord: function(record) {
        if ( !record ) {
            Ext.Msg.alert("Problem unapproving record", "Can't find record");
            return;
        }
        
        record.unapprove();
    },
    
    _unapproveRecords: function() {
        var record = this.record;
        var records = this.records;
                
        if ( records.length === 0 ) {
            records = [record];
        }
        var me = this;
        Ext.Array.each(records, function(r) {
            me._unapproveRecord(r);
        });
    }
});