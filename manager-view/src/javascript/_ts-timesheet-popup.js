Ext.define('Rally.technicalservices.ManagerDetailDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    autoShow : true,
    closable : true,
    layout   : 'border',
    
    config: {
        startDate: new Date(),
        record: null,
        commentKeyPrefix: ''
    },

    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
    },

    initComponent: function() {
        this.callParent(arguments);
    },
    
    beforeRender: function() {
        this.callParent(arguments);
        this.add({ 
            xtype:  'tstimetable',
            region: 'center',
            layout: 'fit',
            weekStart: this.startDate,
            editable: false,
            timesheet_user: this.record.get('User')
        });
        this.addDocked({
            xtype: 'container',
            dock: 'bottom',
            layout: 'hbox',
            itemId: 'popup_selector_box',
            padding: 10,
            items: [
                {xtype:'container', itemId:'popup_left_box'},
                {xtype:'container',  flex: 1},
                {xtype:'container', itemId:'popup_right_box'}
            ]
        });
        
        this._addSelectors();
    },
    
    _addSelectors: function() {
        var start_date = this.startDate;
        var comment_start_date = Rally.util.DateTime.toIsoString(
            new Date(start_date.getUTCFullYear(), 
                start_date.getUTCMonth(), 
                start_date.getUTCDate(),  
                start_date.getUTCHours(), 
                start_date.getUTCMinutes(), 
                start_date.getUTCSeconds()
            )
        ).replace(/T.*$/,'');
        
        var comment_key = Ext.String.format("{0}.{1}.{2}", 
            this.commentKeyPrefix,
            comment_start_date,
            this.record.get('User').ObjectID
        );
        
        this.down('#popup_left_box').add({
            xtype:'tscommentbutton',
            toolTipText: 'Read/Add Comments',
            keyPrefix: comment_key
        });

        this.down('#popup_right_box').add({
            xtype:'rallybutton', 
            text:'Unapprove',
            disabled: (status != "Approved" || !this._currentUserCanUnapprove()),
            listeners: {
                scope: this,
                click: function() {
                    this._unapproveTimesheet(record);
                    this.close();
                }
            }
        });
        
        this.down('#popup_right_box').add({
            xtype:'rallybutton', 
            text:'Approve',
            disabled: (status == "Approved"),
            listeners: {
                scope: this,
                click: function() {
                    this._approveTimesheet(record);
                    this.close();
                }
            }
        });
    },
    
    _approveTimesheet: function(record) {
        record.approve();
    },
    
    _unapproveTimesheet: function(record) {
        record.unapprove();
    }
    
});