Ext.define("TSExtendedTimesheet", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 5 },

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
        container.add({
            xtype:'rallybutton',
            text: 'Add My Tasks',
            padding: 2,
            disabled: true,
            listeners: {
                scope: this,
                click: this._addCurrentTasks
            }
        });
        
        container.add({
            xtype:'rallybutton',
            text: '+<span class="icon-task"> </span>',
            disabled: true,
            listeners: {
                scope: this,
                click: this._findAndAddTask
            }
        });
        
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
        
        Ext.Array.each( this.query('rallybutton'), function(button) {
            button.setDisabled(true);
        });
        
        this.startDate = this.down('#date_selector').getValue();
        this.logger.log("Date changed to:", this.startDate);
        
        this.time_table = display_box.add({ 
            xtype: 'tstimetable',
            region: 'center',
            layout: 'fit',
            weekStart: this.startDate,
            listeners: {
                scope: this,
                gridReady: function() {
                    this.logger.log("Grid is ready");
                    Ext.Array.each( this.query('rallybutton'), function(button) {
                        button.setDisabled(false);
                    });
                }
            }
        });
    },
    
    _addCurrentTasks: function() {
        var timetable = this.down('tstimetable');
        if (timetable) {
            this.setLoading("Finding current tasks...");
            var config = {
                model: 'Task',
                context: {
                    project: null
                },
                fetch: ['ObjectID','Name','FormattedID','WorkProduct'],
                filters: [
                    {property:'Owner.ObjectID',value:this.getContext().getUser().ObjectID},
                    {property:'Iteration.StartDate',operator: '<=', value:Rally.util.DateTime.toIsoString(new Date())},
                    {property:'Iteration.EndDate',  operator: '>=', value:Rally.util.DateTime.toIsoString(new Date())}
                ]
            };
            
            this._loadWsapiRecords(config).then({
                scope: this,
                success: function(tasks) {
                    this.logger.log("Found", tasks);
                    Ext.Array.each(tasks, function(task){
                        timetable.addRowForTask(task);
                    });
                    
                    this.setLoading(false);
                },
                failure: function(msg) {
                    Ext.Msg.alert("Problem loading current tasks", msg);
                }
            });
        }
    },
    
    _findAndAddTask: function() {
        var timetable = this.down('tstimetable');
        if (timetable) {
            Ext.create('Rally.technicalservices.ChooserDialog', {
                artifactTypes: ['task'],
                autoShow: true,
                title: 'Choose a Task',
                fetchFields: ['WorkProduct','Feature','Project', 'ObjectID', 'Name', 'Release'],
                listeners: {
                    artifactchosen: function(dialog, selectedRecord){
                        timetable.addRowForTask(selectedRecord);
                    },
                    scope: this
                }
             });
        }
    },
    
    _getBeginningOfWeek: function(js_date){
        var start_of_week_here = Ext.Date.add(js_date, Ext.Date.DAY, -1 * js_date.getDay());
        return start_of_week_here;
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        
        var final_config = Ext.Object.merge(default_config,config);
        this.logger.log("Starting load:",final_config.model);
          
        Ext.create('Rally.data.wsapi.Store', final_config).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
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
