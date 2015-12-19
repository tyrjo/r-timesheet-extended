Ext.define('Rally.technicalservices.UnlockMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsunlockmenuitem',


    config: {
        text: 'Unlock',
        records: []
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this.shouldShowMenuItem;
        config.handler   = config.handler || this._unlockRecords;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    shouldShowMenuItem: function(record) {
        if ( this.records && this.records.length > 0 ) {
            var should_show = true;
            Ext.Array.each(this.records, function(r){
                if ( !this._isUnlockable(r) ) {
                    should_show = false;
                }
            },this);
            return should_show;
        }
        return this._isUnlockable(record);
    },
    
    _isUnlockable: function(record) {
        return ( record.get('__Status') && record.get('__Status') == "Approved" );
    },
    
    _unlockRecord: function() {
        var record = this.record;
        if ( !record ) {
            Ext.Msg.alert("Problem unlocking record", "Can't find record");
            return;
        }
        
        record.unlock();
    },
    
    _unlockRecords: function() {
        var record = this.record;
        var records = this.records;
        
        if ( records.length === 0 ) {
            records = [record];
        }
        
        Ext.Array.each(records, function(record) {
            this._unlockRecord(record);
        },this);
    }
});