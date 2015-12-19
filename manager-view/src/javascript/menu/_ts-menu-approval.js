
Ext.define('Rally.technicalservices.TimeApprovalRecordMenu', {
    extend: 'Rally.ui.menu.RecordMenu',
    alias: 'widget.tstimeapprovalrecordmenu',

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
        owningEl: undefined

    },

    initComponent: function() {
        this.items = this._getMenuItems();
        
        this.callParent(arguments);
    },

    _getMenuItems: function() {
        var record = this.getRecord(),
            items = [],
            popoverPlacement = this.popoverPlacement || Rally.ui.popover.Popover.DEFAULT_PLACEMENT;

        var current
        items.push({
            xtype: 'tsapprovemenuitem',
            view: this.view,
            record: record
        });
                
        if ( this.canUnlock ) {
            items.push({
                xtype: 'tsunlockmenuitem',
                view: this.view,
                record: record
            });
        }

        return items;
    }
});