Ext.define('Rally.technicalservices.UnlockMenuItem', {
    extend: 'Rally.ui.menu.item.RecordMenuItem',
    alias: 'widget.tsunlockmenuitem',


    config: {
        text: 'Unlock'
    },

    constructor: function(config) {
        config = config || {};

        config.predicate = config.predicate || this._isUnlockable;
        config.handler   = config.handler || this._unlockRecord;
        
        this.initConfig(config);
        this.callParent([config]);
    },
    
    _isUnlockable: function(record) {
        return ( record.get('__Status') && record.get('__Status') == "Approved" );
    },
    
    _unlockRecord: function() {
        var record = this.record;
        if ( !record ) {
            Ext.Msg.alert("Problem approving record", "Can't find record");
            return;
        }
        
        record.unlock();
    }
});