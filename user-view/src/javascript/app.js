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
    
    config: {
        defaultSettings: {
            preferenceProjectRef: '/project/51712374295'
        }
    },
   
    _commentKeyPrefix: 'rally.technicalservices.timesheet.comment',

    launch: function() {
        var preference_project_ref = this.getSetting('preferenceProjectRef');
        
        this._absorbOldApprovedTimesheets().then({
            scope: this,
            success: function(results) {
                this.setLoading(false);
                
                this.logger.log("Updated ", results, " timesheets");
                
                if ( !  TSUtilities.isEditableProjectForCurrentUser(preference_project_ref,this) ) {
                    Ext.Msg.alert('Contact your Administrator', 'This app requires editor access to the preference project.');
                } else {
                    this._addSelectors(this.down('#selector_box'));
                }
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem Reviewing Past Timesheets", msg);
            }
        });
    },
    
    _addSelectors: function(container) {
        container.add({
            xtype:'container',
            itemId: 'button_box'
        });
        
        container.add({ xtype:'container', itemId:'status_box'});
        
        container.add({xtype:'container',flex: 1});
        
        container.add({
            xtype:'rallydatefield',
            itemId:'date_selector',
            fieldLabel: 'Week Starting',
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = TSDateUtils.getBeginningOfWeekForLocalDate(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                    if ( new_value.getDay() === 0 ) {
                        this.updateData();
                    }
                }
            }
        }).setValue(new Date());
        
        //if ( this.isExternal() ) {
            container.add({type:'container', html: '&nbsp;&nbsp;&nbsp;', border: 0, padding: 10});
        //}
    },
    
    _addButtons: function(container) {
        container.removeAll();
        
        container.add({
            xtype:'rallybutton',
            text: 'Add My Tasks',
            toolTipText: "(in current iteration or set as default)", 
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
            toolTipText: "Search and add Tasks", 
            listeners: {
                scope: this,
                click: this._findAndAddTask
            }
        });
        
        container.add({
            xtype:'rallybutton',
            text: '+<span class="icon-story"> </span>',
            toolTipText: "Search and add User Stories",
            disabled: true,
            listeners: {
                scope: this,
                click: this._findAndAddStory
            }
        });
        
        this._addCommentButton(container);
    },
    
    _addCommentButton: function(container) {
        this.logger.log('_addCommentButton', this.startDateString);
        var start_date = this.startDateString;
        
        var comment_key = Ext.String.format("{0}.{1}.{2}", 
            this._commentKeyPrefix,
            start_date,
            this.getContext().getUser().ObjectID
        );
        
        container.add({
            xtype:'tscommentbutton',
            toolTipText: 'Read/Add Comments',
            keyPrefix: comment_key
        });
    },
    
    updateData: function()  { 
        var me = this;
        
        Ext.Array.each( this.query('rallybutton'), function(button) {
            button.setDisabled(true);
        });
                                
        var display_box = this.down('#display_box');
        var button_box = this.down('#button_box');
        var status_box = this.down('#status_box');
        
        display_box.removeAll();
        button_box.removeAll();
        status_box.removeAll();
        
        this.startDate = this.down('#date_selector').getValue();
        this.startDateString = TSDateUtils.getBeginningOfWeekISOForLocalDate(this.startDate);
        
        this.logger.log("Date changed to:", this.startDate, this.startDateString);
        
        Deft.Chain.sequence([
            this._loadWeekStatusPreference,
            this._loadWeekLockPreference
        ],this).then({
            scope: this,
            success: function(results) {

                var status_prefs = results[0];
                var week_lock_prefs = results[1];
                
                var editable = true;
                if ( status_prefs.length > 0 ) {
                    var value = status_prefs[0].get('Value');
                    var status_object = Ext.JSON.decode(value);
                    if ( status_object.status == "Approved" ) { 
                        editable = false;
                        status_box.add({xtype:'container',html:'Approved'});
                    }
                }
                if ( week_lock_prefs.length > 0 ) {
                    var value = week_lock_prefs[0].get('Value');
                    var status_object = Ext.JSON.decode(value);

                    if ( status_object.status == "Locked" ) { 
                        editable = false;
                        status_box.add({xtype:'container',html:'Week Locked'});
                    }
                }

                this.time_table = display_box.add({ 
                    xtype: 'tstimetable',
                    region: 'center',
                    layout: 'fit',
                    startDate: this.startDate,
                    editable: editable,
                    listeners: {
                        scope: this,
                        gridReady: function() {
                            this._addButtons(button_box);
                            if ( editable ) {
                                Ext.Array.each( this.query('rallybutton'), function(button) {
                                    button.setDisabled(false);
                                });
                            }
                        }
                    }
                });
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem loaing approval information", msg);
            }
        });
    },
    
    _getWeekStartFromKey: function(key) {
        var name_array = key.get('Name').split('.');
        
        if ( name_array.length < 5 ) {
            return null;
        }
        
        return name_array[4];
        
    },
    
    _absorbOldApprovedTimesheets: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        this.setLoading('Reviewing Past Timesheets');
        
        //var this_week_start = TSDateUtils.getBeginningOfWeekISOForLocalDate(new Date());
        var this_week_start = TSDateUtils.formatShiftedDate(new Date(),'Y-m-d');
        
        var append_filters = Rally.data.wsapi.Filter.and([
            { property: 'Name', operator:'contains', value: Rally.technicalservices.TimeModelBuilder.appendKeyPrefix },
            { property: 'Name', operator:'<', value: Rally.technicalservices.TimeModelBuilder.appendKeyPrefix + '.' + this_week_start },
            { property: 'Name', operator:'contains', value: this.getContext().getUser().ObjectID}
        ]);
        
        var amend_filters = Rally.data.wsapi.Filter.and([
            { property: 'Name', operator:'contains', value: Rally.technicalservices.TimeModelBuilder.amendKeyPrefix },
            { property: 'Name', operator:'<', value: Rally.technicalservices.TimeModelBuilder.amendKeyPrefix + '.' + this_week_start },
            { property: 'Name', operator:'contains', value: this.getContext().getUser().ObjectID}
        ]);
        
        var change_filters = append_filters.or(amend_filters);
        
        var non_archived_filters = Rally.data.wsapi.Filter.and([
            { property: 'Name', operator:'!contains', value: TSUtilities.archiveSuffix }
        ]);
        
        var filters = change_filters.and(non_archived_filters);
                
        var config = {
            model: 'Preference',
            filters: filters,
            fetch: ['Name','Value','ObjectID'],
            sorters: [{property:'Name', direction: 'DESC'}]
        }
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                    
                    var week_hash = {};
                    Ext.Array.each(preferences, function(preference){
                        var key = me._getWeekStartFromKey(preference);
                        if ( Ext.isEmpty(week_hash[key]) ) { 
                            week_hash[key] = [];
                        }
                        week_hash[key].push(preference);
                    });
                    
                                        
                    var promises = [];
                    
                    Ext.Object.each(week_hash, function(changed_week, preferences){
                        promises.push( function() { return me._absorbOldApprovedTimesheet(changed_week,preferences); } );
                    });
                                        
                    Deft.Chain.sequence(promises).then({
                        success: function(results) {
                            deferred.resolve(Ext.Array.sum(results));
                        },
                        failure: function(msg) { deferred.reject(msg); }
                    
                    });
            },
            failure: function(msg) { deferred.reject(msg); }
        });
        
        return deferred.promise;
    },
    
    _absorbOldApprovedTimesheet: function(week_start,changes) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
            
        // is this approved?
        this.setLoading('Reviewing ' + week_start);
        
        TSDateUtils.isApproved(week_start).then({
            scope: this,
            success: function(result) {
                if ( !result ) {
                    this.logger.log("  Not approved; skipping");
                    deferred.resolve(0);
                    return;
                }
                
                this.setLoading('Absorbing Manager Change ' + week_start);
                
                var timetable = Ext.create('Rally.technicalservices.TimeTable',{
                    startDate: Ext.Date.parse(week_start,'Y-m-d'),
                    editable: false,
                    timesheet_status: 'Approved',
                    timesheet_user: this.getContext().getUser(),
                    listeners: {
                        scope: this,
                        gridReady: function(t, grid) {
                            if ( grid.getStore().isLoading() ) {
                                grid.getStore().on('load', function() {
                                    this._absorbChanges(t,changes).then({
                                        success: function(results) {
                                            console.log('a');
                                            deferred.resolve(1);
                                        },
                                        failure: function(msg) { 
                                            deferred.reject(msg);
                                        }
                                    });
                                }, this, { single: true });
                            } else {
                                this._absorbChanges(t,changes).then({
                                    success: function(results) {
                                        console.log('b');
                                        deferred.resolve(1);
                                    },
                                    failure: function(msg) { 
                                        deferred.reject(msg);
                                    }
                                });
                            }
                        }
                    }
                });
                
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
            
        });
        return deferred.promise;
    },
    
    _absorbChanges: function(timetable,changes) {
        var deferred = Ext.create('Deft.Deferred');
        
        var promises = [];
        
        Ext.Array.each(changes, function(change) {
            var value = Ext.JSON.decode(change.get('Value'));
            value.ObjectID = change.get('ObjectID');
            value.__PrefID = change.get('ObjectID');
            
            var row = Ext.create('TSTableRow', value);
            promises.push( function() { return timetable.absorbTime(row); });
        });
                
        Deft.Chain.sequence(promises).then({
            success: function(results) {
                console.log('done _absorbChanges');
                deferred.resolve(results);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },

    _loadWeekStatusPreference: function() {        
        var key = Ext.String.format("{0}.{1}.{2}", 
            TSUtilities.approvalKeyPrefix,
            this.startDateString,
            this.getContext().getUser().ObjectID
        );
        this.logger.log('finding by key',key);
        
        var config = {
            model:'Preference',
            limit: 1,
            pageSize: 1,
            filters: [
                {property:'Name',operator: 'contains', value:key},
                {property:'Name',operator:'!contains',value: TSUtilities.archiveSuffix}
            ],
            fetch: ['Name','Value'],
            sorters: [{property:'CreationDate', direction: 'DESC'}]
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadWeekLockPreference: function() {
        
        var key = Ext.String.format("{0}.{1}", 
            TSUtilities.timeLockKeyPrefix,
            this.startDateString
        );
        this.logger.log('finding by key',key);
        
        var filters = [
            {property:'Name',operator:'contains', value:key},
            {property:'Name',operator:'!contains',value:TSUtilities.archiveSuffix }
        ];
        
        var config = {
            model:'Preference',
            limit: 1,
            pageSize: 1,
            filters: filters,
            fetch: ['Name','Value'],
            sorters: [{property:'CreationDate',direction:'DESC'}]
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _addCurrentTasks: function() {
        var timetable = this.down('tstimetable');
        if (timetable) {
            this.setLoading("Finding my current tasks...");
            var config = {
                model: 'Task',
                context: {
                    project: null
                },
                fetch: Ext.Array.merge(
                    Rally.technicalservices.TimeModelBuilder.getFetchFields(),
                    ['ObjectID','Name','FormattedID','WorkProduct','Project']
                ),
                filters: [
                    {property:'Owner.ObjectID',value:this.getContext().getUser().ObjectID},
                    {property:'Iteration.StartDate',operator: '<=', value:Rally.util.DateTime.toIsoString(new Date())},
                    {property:'Iteration.EndDate',  operator: '>=', value:Rally.util.DateTime.toIsoString(new Date())}
                ]
            };
            
            TSUtilities.loadWsapiRecords(config).then({
                scope: this,
                success: function(tasks) {
                    var new_item_count = tasks.length;
                    var current_count  = timetable.getGrid().getStore().getTotalCount();
                    
                    if ( current_count + new_item_count > 100 ) {
                        Ext.Msg.alert('Problem Adding Items', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        this.setLoading(false);
                    } else {
                        Ext.Array.each(tasks, function(task){
                            timetable.addRowForItem(task);
                        });
                        this._addPinnedItems();
                    }
                    
                    
                },
                failure: function(msg) {
                    Ext.Msg.alert("Problem loading current tasks", msg);
                }
            });
        }
    },
    
    _addPinnedItems: function() {
        var me = this,
            timetable = this.down('tstimetable');

        if ( timetable.getDefaultPreference().getPinnedOIDs().length === 0 ) {
            this.setLoading(false);
            return;
        }
        
        Deft.Chain.sequence([ 
            function() { return me._addPinnedItemsByType('hierarchicalrequirement'); },
            function() { return me._addPinnedItemsByType('defect'); },
            function() { return me._addPinnedItemsByType('task'); }
            
        ]).then({
            scope: this,
            success: function() {
                this.setLoading(false);
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem loading pinned items",msg);
                this.setLoading(false);
            }
        });
    },
    
    _addPinnedItemsByType: function(type) {
        var deferred = Ext.create('Deft.Deferred');
        var timetable = this.down('tstimetable');
        
        if (!timetable) {
            return; 
        }
        
        this.setLoading("Finding items of type " + type + "...");
        
        var oids = timetable.getDefaultPreference().getPinnedOIDs();
        
        var config = {
            model: type,
            context: {
                project: null
            },
            fetch: Ext.Array.merge(
                Rally.technicalservices.TimeModelBuilder.getFetchFields(),
                ['ObjectID','Name','FormattedID','WorkProduct','Project','Release']
            ),
            filters: Rally.data.wsapi.Filter.or(Ext.Array.map(oids, function(oid) { return {property:'ObjectID',value:oid}; }))
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(items) {
                var promises = [];
                
                var new_item_count = items.length;
                var current_count  = timetable.getGrid().getStore().getTotalCount();
                
                if ( current_count + new_item_count > 100 ) {
                    deferred.reject( 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                } else {
                 
                    Ext.Array.each(items, function(item){
    
                        if ( item.get('Release') && item.get('Release').c_IsDeployed == true ) {
                            console.log('Cannot add item because it is locked');
                            
                            promises.push(function() { return timetable.unpinTime(item); });
                            
                            return;
                        }
                        timetable.addRowForItem(item);
                    });
                    
                    if ( promises.length === 0 ) {
                        deferred.resolve(items);
                    } else {
                        Deft.Chain.sequence(promises).then({
                            success: function(results) {
                                deferred.resolve(results);
                            },
                            failure: function(msg) {
                                deferred.reject(msg);
                            }
                        });
                    }
                }
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _findAndAddTask: function() {
        var timetable = this.down('tstimetable');
        
        var fetch_fields = Ext.Array.merge(
            Rally.technicalservices.TimeModelBuilder.getFetchFields(),
            ['WorkProduct','Feature','Project']
        );
                
        if (timetable) {
            Ext.create('Rally.technicalservices.ChooserDialog', {
                artifactTypes: ['task'],
                autoShow: true,
                multiple: true,
                title: 'Choose Task(s)',
                filterableFields: [
                    {
                        displayName: 'Formatted ID',
                        attributeName: 'FormattedID'
                    },
                    {
                        displayName: 'Name',
                        attributeName: 'Name'
                    },
                    {
                        displayName:'WorkProduct',
                        attributeName: 'WorkProduct.Name'
                    },
                    {
                        displayName:'Release',
                        attributeName: 'Release.Name'
                    },
                    {
                        displayName:'Project',
                        attributeName: 'Project.Name'
                    },
                    {
                        displayName:'Owner',
                        attributeName: 'Owner'
                    },
                    {
                        displayName: 'State',
                        attributeName: 'State'
                    }
                ],
                columns: [
                    {
                        text: 'ID',
                        dataIndex: 'FormattedID'
                    },
                    'Name',
                    'WorkProduct',
                    'Release',
                    'Project',
                    'Owner',
                    'State'
                ],
                fetchFields: fetch_fields,
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        var new_item_count = selectedRecords.length;
                        var current_count  = timetable.getGrid().getStore().getTotalCount();
                        
                        if ( current_count + new_item_count > 100 ) {
                            Ext.Msg.alert('Problem Adding Tasks', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        } else {
                            
                            Ext.Array.each(selectedRecords, function(selectedRecord){
                                timetable.addRowForItem(selectedRecord);
                            });
                        }
                    },
                    scope: this
                }
             });
        }
    },
    
    _findAndAddStory: function() {
        var timetable = this.down('tstimetable');
        if (timetable) {
            Ext.create('Rally.technicalservices.ChooserDialog', {
                artifactTypes: ['hierarchicalrequirement'],
                autoShow: true,
                title: 'Choose Story(ies)',
                multiple: true,
                filterableFields: [
                    {
                        displayName: 'Formatted ID',
                        attributeName: 'FormattedID'
                    },
                    {
                        displayName: 'Name',
                        attributeName: 'Name'
                    },
                    {
                        displayName:'Feature',
                        attributeName: 'Feature.Name'
                    },
                    {
                        displayName: 'Feature Project',
                        attributeName: 'Feature.Project.Name'
                    },
                    {
                        displayName:'Release',
                        attributeName: 'Release.Name'
                    },
                    {
                        displayName:'Project',
                        attributeName: 'Project.Name'
                    },
                    {
                        displayName:'Owner',
                        attributeName: 'Owner'
                    },
                    {
                        displayName:'State',
                        attributeName: 'ScheduleState'
                    }
                ],
                columns: [
                    {
                        text: 'ID',
                        dataIndex: 'FormattedID'
                    },
                    'Name',
                    'WorkProduct',
                    'Release',
                    'Project',
                    'Owner',
                    'ScheduleState'
                ],
        
                fetchFields: Ext.Array.merge(
                    Rally.technicalservices.TimeModelBuilder.getFetchFields(),
                    ['WorkProduct','Feature','Project', 'ObjectID', 'Name', 'Release']
                ),
                listeners: {
                    artifactchosen: function(dialog, selectedRecords){
                        if ( !Ext.isArray(selectedRecords) ) {
                            selectedRecords = [selectedRecords];
                        }
                        
                        var new_item_count = selectedRecords.length;
                        var current_count  = timetable.getGrid().getStore().getTotalCount();
                        
                        if ( current_count + new_item_count > 100 ) {
                            Ext.Msg.alert('Problem Adding Stories', 'Cannot add items to grid. Limit is 100 lines in the time sheet.');
                        } else {
                            Ext.Array.each(selectedRecords, function(selectedRecord){
                                timetable.addRowForItem(selectedRecord);
                            });
                        }
                    },
                    scope: this
                }
             });
        }
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [{
            name: 'preferenceProjectRef',
            xtype:'rallyprojectpicker',
            fieldLabel: 'Preference Project',
            workspace: this.getContext().getWorkspaceRef(),
            showMostRecentlyUsedProjects : false,
            autoExpand: true,
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10
        }];
    },
    
//    getOptions: function() {
//        return [
//            {
//                text: 'About...',
//                handler: this._launchInfo,
//                scope: this
//            }
//        ];
//    },
    
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