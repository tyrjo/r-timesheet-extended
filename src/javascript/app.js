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
        this._addSelectors(this.down('#selector_box'));
        //this.updateData();
    },
    
    _addSelectors: function(container) {
        container.add({xtype:'container',flex: 1});
        
        container.add({
            xtype:'rallydatefield',
            itemId:'date_selector',
            fieldLabel: 'Week Starting',
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = this._getBeginningOfWeek(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                    if ( new_value.getDay() === 0 ) {
                        this.updateData();
                    }
                }
            }
        }).setValue(new Date());
        
        if ( this.isExternal() ) {
            container.add({type:'container', html: '......'});
        }
    },
    
    updateData: function()  { 
        var me = this;
        
        var display_box = this.down('#display_box');
        
        display_box.removeAll();
        
        this.startDate = this.down('#date_selector').getValue();
        this.logger.log("Date changed to:", this.startDate);
        
        this.time_table = display_box.add({ 
            xtype: 'tstimetable',
            region: 'center',
            layout: 'fit',
            weekStart: this.startDate,
            listeners: {
                gridReady: function() {
                    // to do
                }
            }
        });
    },
    
    _getBeginningOfWeek: function(js_date){
        var start_of_week_here = Ext.Date.add(js_date, Ext.Date.DAY, -1 * js_date.getDay());
        return start_of_week_here;
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
