
Ext.define('Rally.technicalservices.TimeEntryRecordMenu', {
    extend: 'Rally.ui.menu.RecordMenu',
    alias: 'widget.tstimeentryrecordmenu',

    config: {

        /**
         * @cfg {Rally.data.Model} record (required)
         * The record to build the menu for
         */
        record: null,

        /**
         * @cfg {Ext.Element|HTMLElement} (optional) owningEl
         * The element this menu item is being invoked against.
         */
        owningEl: undefined,
        
        forModification: false

    },

    initComponent: function() {
        this.items = this._getMenuItems();
        
        this.callParent(arguments);
    },

    _getMenuItems: function() {
        var record = this.getRecord(),
            records = this.records || [],
            items = [],
            popoverPlacement = this.popoverPlacement || Rally.ui.popover.Popover.DEFAULT_PLACEMENT;

        console.log('--', record);
        
        if ( records && records.length > 0 ) {
            // bulk edit
            items.push({
                xtype: 'tsremovetimeentrymenuitem',
                view: this.view,
                record: record,
                records: records
            });
           
        } else {
            if ( this.forModification ) {
                if ( record.get('__Appended') || record.get('__Amended')) {
//                    items.push({
//                        xtype: 'tsremovetimeentrymenuitem',
//                        view: this.view,
//                        record: record
//                    });
                } else {
                    items.push({
                        xtype: 'tsaltertimeentrymenuitem',
                        view: this.view,
                        record: record
                    });
                }
            } else {
                items.push({
                    xtype: 'tsremovetimeentrymenuitem',
                    view: this.view,
                    record: record
                });
            }
                    
        }
        return items;
    }
});