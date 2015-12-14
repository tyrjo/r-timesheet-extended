Ext.define("TSExtendedTimesheet", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    layout: { type: 'border' },
    
    items: [
        {xtype:'container', itemId:'selector_box', region: 'north',  layout: { type:'hbox' }, minHeight: 25},
        {xtype:'container', itemId:'display_box' , region: 'center', layout: { type: 'border'} }
    ],

    integrationHeaders : {
        name : "TSExtendedTimesheet"
    },
                        
    launch: function() {
        this.updateData();
    },
    
    updateData: function()  { 
        var me = this;
        
        var display_box = this.down('#display_box');
        
        display_box.removeAll();
        
        this.time_table = display_box.add({ 
            xtype: 'tstimetable',
            region: 'center',
            layout: 'fit',
            listeners: {
                gridReady: function() {
                    // to do
                }
            }
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
