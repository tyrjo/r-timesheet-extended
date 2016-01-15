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
                    this._unapproveTimesheet(this.record);
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
                    this._approveTimesheet(this.record);
                    this.close();
                }
            }
        });
        
        this.down('#popup_right_box').add({
            xtype:'rallybutton',
            itemId:'export_button',
            cls: 'secondary',
            text: '<span class="icon-export"> </span>',
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            }
        });
        
    },
    
    _approveTimesheet: function(record) {
        record.approve();
    },
    
    _unapproveTimesheet: function(record) {
        record.unapprove();
    },
    
    _export: function(){
        var grid = this.down('tstimetable').getGrid();
        var me = this;
        
        if ( !grid ) { return; }
        
        var filename = Ext.String.format('manager-detail-report.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromGrid(this,grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    }
    
});