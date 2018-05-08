Ext.override(Rally.ui.grid.plugin.Validation,{
    _onBeforeEdit: function(editor, object, eOpts) {
        // clear this because it won't let us do the getEditor on cells
    }
});

/**
 */
 
 Ext.define('Rally.technicalservices.TimeTable', {
    extend: 'Ext.Container',
    alias: 'widget.tstimetable',
    
    mixins: ['Ext.state.Stateful'],
    
    logger: new Rally.technicalservices.Logger(),

    rows: [],
    columns: null,
    
    /**
     * @property {String} cls The base class applied to this object's element
     */
    cls: "tstimetable",

    time_entry_item_fetch: undefined,   // set in constructor
        
    config: {
        startDate: null,
        editable: true,
        timesheet_user: null,
        timesheet_status: null,
        manager_field: null,
        week_locked: false
    },
    
    stateId: 'ca.technicalservices.extended.timesheet.columns',
    stateful: true,
    stateEvents: ['columnresize'],
/*
    getState: function() {
        var me = this,
            state = null;

        state = {
            columns: this.columns
        };

        return state;
    },
    
    applyState: function(state) {
        if (state) {
            Ext.apply(this, state);
        }
    },
    */
    
    constructor: function (config) {
        this.time_entry_item_fetch = ['WeekStartDate','WorkProductDisplayString','WorkProduct','Requirement', 'Task',
        'TaskDisplayString', TSUtilities.lowestPortfolioItemTypeName, 'Project', 'ObjectID', 'Name', 'Release'];
        
        this.mergeConfig(config);
        
        if (Ext.isEmpty(config.startDate) || !Ext.isDate(config.startDate)) {
            throw "Rally.technicalservices.TimeTable requires startDate parameter (JavaScript Date)";
        }
        this.callParent([this.config]);
    },

    initComponent: function () {
        var me = this;
        this.callParent(arguments);
        
        this.addEvents(
            /**
             * @event
             * Fires when the grid has been rendered
             * @param {Rally.technicalservices.TimeTable} this
             * @param {Rally.ui.grid.Grid} grid
             */
            'gridReady'
        );
        
        // If the startDate is not a Sunday (which is Agile Central's start day of week (and required
        // by TimeEntryItem models), then we must create two TimeEntryItems. One is for the Sunday
        // prior to this start date, and one is for the Sunday after this start date.
        this.weekISOStartStrings = TSDateUtils.getWeekISOStartStrings(this.startDate);
        this.origStartDateString = TSDateUtils.getBeginningOfWeekISOForLocalDate(this.startDate, true);

        if ( Ext.isEmpty(this.timesheet_user) ) {
            this.timesheet_user = Rally.getApp().getContext().getUser();
        }
        
        Deft.Chain.sequence([
            me._getTEIModel,
            function() { return Rally.technicalservices.TimeModelBuilder.build('TimeEntryItem','TSTableRow'); },
            me._loadPortfolioItemModel,
        ],this).then({
            scope: this,
            success: function(model) {
                this._updateData();
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem creating model', msg);
            }
        });
    },
    
    _getTEIModel: function() {
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: 'TimeEntryItem',
            scope: this,
            success: function(model) {
                this.tei_model = model;
                deferred.resolve(model);
            }
        });
        return deferred.promise;
    },
    
    _updateData: function() {
        this.setLoading('Loading time...');
        var me = this;

        Deft.Chain.sequence([
            this._loadTimeEntryItems,
            this._loadTimeEntryValues,
            this._loadTimeEntryAppends,
            this._loadTimeEntryAmends,
            this._loadDefaultPreference,
        ],this).then({
            scope: this,
            success: function(results) {
                var time_entry_items  = results[0]; // TODO (tj) must merge TEI results
                var time_entry_values = results[1]; // TODO (tj) must merge TEV results?
                var time_entry_appends = results[2];    // TODO (tj) must merge TEAp results?
                var time_entry_amends = results[3]; // TODO (tj) must merge TEAm results?
                var time_default_preference = results[4];
                
                this.timePreference = Ext.create('TSDefaultPreference');
                
                if ( time_default_preference.length > 0 ) {
                    this.timePreference = Ext.create('TSDefaultPreference', { '__Preference': time_default_preference[0] });
                }
                this.logger.log('Time preference: ', this.timePreference);
                
                var rows = Ext.Array.map(time_entry_items, function(item){
                    var product = item.get('Project');

                    var workproduct = item.get('WorkProduct');
                    var feature = null;
                    var release = null;
                    var iteration = null;
                    
                    if ( !Ext.isEmpty(workproduct) ) {
                        product = workproduct.Project;
                        
                        var portfolioItem;
                        if ( workproduct[TSUtilities.lowestPortfolioItemTypeName] ) {
                            // User stories have a direct reference to a portfolio item
                            portfolioItem = workproduct[TSUtilities.lowestPortfolioItemTypeName];
                        } else if (workproduct['Requirement']) {
                            // For defects, first get the `Requirement` story, then use that to get the portfolio item.
                            var requirement = workproduct['Requirement'];
                            portfolioItem = requirement[TSUtilities.lowestPortfolioItemTypeName];
                        }
                        
                        if ( portfolioItem ) {
                            feature = portfolioItem;
                            product = feature.Project;
                        }
                        
                        if ( workproduct.Release ) {
                            release = workproduct.Release;
                        }
                        
                        if ( workproduct.Iteration ) {
                            iteration = workproduct.Iteration;
                        }
                    }
                    
                    var data = {
                        __TimeEntryItem:item,
                        __Feature: feature,
                        __Iteration: iteration,
                        __Product: product,
                        __Release: release,
                        __Pinned: me._isItemPinned(item)
                    };
                    
                    // TODO (tj) extra columns State, Estimate, Iteration
                    return Ext.create('TSTableRow',Ext.Object.merge(data, item.getData()));
                });
                
                var rows = this._addTimeEntryValues(rows, time_entry_values);
                var appended_rows = this._getAppendedRowsFromPreferences(time_entry_appends);
                var amended_rows = this._getAmendedRowsFromPreferences(time_entry_amends);
                
                this.logger.log('TEIs:', time_entry_items);
                this.logger.log('Rows:', rows);
                this.logger.log('Appended Rows:', appended_rows);
                this.logger.log('Amended Rows:', amended_rows);

                this.rows = Ext.Array.merge(rows,appended_rows,amended_rows);
                this._makeGrid(this.rows);
                this.setLoading(false);
            }
        });
        
    },
    
    _loadPortfolioItemModel: function() {
        return Rally.data.ModelFactory.getModel({
            type: 'PortfolioItem/' + TSUtilities.lowestPortfolioItemTypeName,
            success: function(model) {
                this.portfolio_item_model = model;
            },
            scope: this
        })    
    },
    
    _getAppendedRowsFromPreferences: function(prefs) {
        // TODO (tj) extra columns from preferences?
        return Ext.Array.map(prefs, function(pref){
            var value = Ext.JSON.decode(pref.get('Value'));
            value.ObjectID = pref.get('ObjectID');
            value.__PrefID = pref.get('ObjectID');

            var row = Ext.create('TSTableRow', value);
            row.set('updatable', true); // so we can add values to the week 

            return row;
        });
    },
    
    _getAmendedRowsFromPreferences: function(prefs) {
        // TODO (tj) extra columns from preferences?
        return Ext.Array.map(prefs, function(pref){
            var value = Ext.JSON.decode(pref.get('Value'));
            value.ObjectID = pref.get('ObjectID');
            value.__PrefID = pref.get('ObjectID');

            var row = Ext.create('TSTableRow', value);
            row.set('updatable', true); // so we can add values to the week 

            return row;
        });
    },
    
    _addTimeEntryValues: function(rows, time_entry_values) {
        var rows_by_oid = {};
        
        Ext.Array.each(rows, function(row) { rows_by_oid[row.get('ObjectID')] = row; });
        
        Ext.Array.each(time_entry_values, function(value){
            var parent_oid = value.get('TimeEntryItem').ObjectID;

            var row = rows_by_oid[parent_oid];
            row.addTimeEntryValue(value);
        });
        
        return rows;
    },
    
    _getTimeEntryItemFilter: function() {
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var weekStartFilter = Rally.data.wsapi.Filter.or(_.map(this.weekISOStartStrings, function(startString){
            return {property:'WeekStartDate',value:startString}
        }));
        var userFilter = new Rally.data.wsapi.Filter({property:'User.ObjectID',value:user_oid});
        return userFilter.and(weekStartFilter);
    },
    
    _getTimeEntryValueFilter: function() {
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var weekStartFilter = Rally.data.wsapi.Filter.or(_.map(this.weekISOStartStrings, function(startString){
            return {property:'TimeEntryItem.WeekStartDate',value:startString}
        }));
        var userFilter = new Rally.data.wsapi.Filter({property:'TimeEntryItem.User.ObjectID',value:user_oid});
        return userFilter.and(weekStartFilter);
    },
    
    _loadTimeEntryItems: function() {
        this.setLoading('Loading time entry items...');

        var config = {
            model: 'TimeEntryItem',
            context: {
                project: null
            },
            fetch: Ext.Array.merge(Rally.technicalservices.TimeModelBuilder.getFetchFields(), 
                this.time_entry_item_fetch,
                [this.manager_field],
                TSUtilities.fetchManagerPortfolioItemFields
            ),
            filters: this._getTimeEntryItemFilter()
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadTimeEntryValues: function() {
        this.setLoading('Loading time entry values...');
        
        var config = {
            model: 'TimeEntryValue',
            context: {
                project: null
            },
            fetch: ['DateVal','Hours','TimeEntryItem','ObjectID'],
            filters: this._getTimeEntryValueFilter()
        };
        
        return TSUtilities.loadWsapiRecords(config);    // TODO (tj) create single TimeEntryItem with app startDate from the two backend items
    },
    
    _getPreferenceFilter: function() {
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var keyFilters = _.map(this.weekISOStartStrings, function(startString){
            var key = Ext.String.format("{0}.{1}.{2}", 
                Rally.technicalservices.TimeModelBuilder.appendKeyPrefix,
                startString.replace(/T.*$/,''),
                user_oid
            );
            return {property:'Name',operator:'contains',value:key}
        });
        
        return keyFilters;
    },
    
    _loadTimeEntryAppends: function() {
        this.setLoading('Loading time entry additions...');
        
        
        
        var config = {
            model: 'Preference',
            context: {
                project: null
            },
            fetch: ['Name','Value','ObjectID'],
            filters: this._getPreferenceFilter()
        };

        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadTimeEntryAmends: function() {
        this.setLoading('Loading time entry amendments...');

        var config = {
            model: 'Preference',
            context: {
                project: null
            },
            fetch: ['Name','Value','ObjectID'],
            filters: this._getPreferenceFilter()
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    getDefaultPreference: function() {
        return this.timePreference;
    },
    
    _loadDefaultPreference: function() {
        this.setLoading('Loading preference information...');
        
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var key = Ext.String.format("{0}.{1}", 
            TSUtilities.pinKeyPrefix,
            user_oid
        );
        
        this.logger.log('finding by key',key);

        var config = {
            model: 'Preference',
            context: {
                project: null
            },
            fetch: ['Name','Value','ObjectID'],
            filters: [
                {property:'Name',operator:'contains',value:key}
            ]
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _makeGrid: function(rows) {
        this.removeAll();

        var table_store = Ext.create('Rally.data.custom.Store',{
            model: 'TSTableRow',
            groupField: '__SecretKey',
            data: rows,
            pageSize: 100
        });
                
        
        var me = this;

        this.grid = this.add({ 
            xtype:'rallygrid', 
            store: table_store,
            columnCfgs: this.getColumns(),
            showPagingToolbar : false,
            showRowActionsColumn : false,
            sortableColumns: true,
            disableSelection: true,
            enableColumnMove: false,
            enableColumnResize : true,

            viewConfig: {
                listeners: {
                    itemupdate: function(row, row_index) {
                        //me.logger.log('itemupdate', row);
                    },
                    viewready: me._addTooltip
                }
            },
            features: [{
                ftype: 'groupingsummary',
                startCollapsed: false,
                hideGroupedHeader: true,
                groupHeaderTpl: ' ',
                enableGroupingMenu: false
            }],
            listeners: {
                scope: this,
                columnresize: function(header_container,column,width){
                    Ext.Array.each(this.columns, function(col){
                        if ( col.dataIndex == column.dataIndex ) {
                            col.width = column.width;
                        }
                    });
                    
                    this.fireEvent('columnresize',this.columns);
                }
            }
        });
        
        this.fireEvent('gridReady', this, this.grid);
        
    },
    
    _addTooltip: function(view) {
        this.toolTip = Ext.create('Ext.tip.ToolTip', {
            target: view.el,
            delegate: view.cellSelector,
            trackMouse: true,
            renderTo: Ext.getBody(),
            listeners: {
                beforeshow: function(tip) {

                    var trigger = tip.triggerElement,
                        parent = tip.triggerElement.parentElement,
                        columnTitle = view.getHeaderByCell(trigger).text,
                        columnDataIndex = view.getHeaderByCell(trigger).dataIndex;
                    var record = view.getRecord(parent);
                    if ( !record ) {
                        return false;
                    }
                    
                    var columnText = null;
                    var value = record.get(columnDataIndex);
                    
                    if ( columnTitle == "Work Product" && ! Ext.isEmpty(value) ) {
                        columnText = value.Project && value.Project._refObjectName;
                    }
                    
                    if (!Ext.isEmpty(columnText)){
                        tip.update("<b>Project:</b> " + columnText);
                    } else {
                        return false;
                    }
                }
            }
        });
    },
    
    _isForCurrentUser: function() {
        return ( this.timesheet_user.ObjectID == Rally.getApp().getContext().getUser().ObjectID);
    },
    
    absorbTime: function(record) {
        
        var clone = Ext.clone(record).getData();
        record.clearAndRemove();

        if ( clone.__Appended ) {
            return this._absorbAppended(clone);
        } else {
            var original_row = this.getRowForAmendedRow(clone);
                        
            if ( Ext.isEmpty(original_row) ) {
                return this._absorbAppended(clone); // original must have been removed
            } else {
                return this._absorbAmended(clone);
            }
        }
        
    },
    
    _absorbAmended: function(clone) {
        var deferred = Ext.create('Deft.Deferred');
        
        var days = _.map(TSDateUtils.getDaysOfWeek(), function(day) {
            return Ext.String.format('__{0}', day);
        });
        days.push('__Total');
        var original_row = this.getRowForAmendedRow(clone);

        //var days = me._getDayValuesFromRow(clone);
        Ext.Array.each(days, function(day) {
            var clone_value = clone[day] || 0;
            var original_value = original_row.get(day) || 0;
            
            var new_value = original_value + clone[day];
            if ( new_value < 0 ) { new_value = 0; }
            if ( new_value > 24 ) { new_value = 24; }
            
            original_row.set(day,new_value);
        });
        
        original_row.save().then({
            success: function(result) {
                deferred.resolve(result);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        
        });
        
        return deferred.promise;
    },
    
    _absorbAppended: function(clone) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        var work_item = clone.Task;
            
        if ( Ext.isEmpty(work_item) ) {
            work_item = clone.WorkProduct;
        }
        
        this._getItemFromRef(work_item._ref).then({
            success: function(item) {
                me.addRowForItem(item,true).then({
                    scope:this,
                    success: function(row) {
                        var days = _.map(TSDateUtils.getDaysOfWeek(), function(day) {
                            return Ext.String.format('__{0}', day);
                        });
                        days.push('__Total');

                        //var days = me._getDayValuesFromRow(clone);
                        Ext.Array.each(days, function(day) {
                            if ( clone[day] > 0 ) {
                                row.set(day,clone[day]);
                            }
                        });
                        
                        row.save().then({
                            success: function(result) {
                                deferred.resolve(result);
                            },
                            failure: function(msg) {
                                deferred.reject(msg);
                            }
                        });
                    },
                    failure: function(msg) {
                        deferred.reject(msg);
                    }
                });
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    pinTime: function(record) {
        if ( this.updatePinProcess && this.updatePinProcess.getState() === 'pending' ) {
            console.log('pinning in process...');
        } else {
            console.log('-- ', this.updatePinProcess && this.updatePinProcess.getState());
        }
        
        this.updatePinProcess = this.timePreference.addPin(record);
        this.updatePinProcess.then({
            success: function() {
                record.set('__Pinned', true);
            },
            failure: function(msg){
                Ext.Msg.alert("Problem saving pin:", msg);
            }
        });
        
    },
    
    unpinTime: function(record) {
        var deferred = Ext.create('Deft.Deferred');
        
        if ( this.updatePinProcess && this.updatePinProcess.getState() === 'pending' ) {
            console.log('pinning in process...');
        } else {
            console.log('-- ', this.updatePinProcess && this.updatePinProcess.getState());
        }
        
        this.updatePinProcess = this.timePreference.removePin(record);
        this.updatePinProcess.then({
            success: function() {
                record.set('__Pinned', false);
                deferred.resolve(record);
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _isItemPinned: function(item) {
        this.logger.log('is Item pinned?', item);
        if ( Ext.isEmpty(this.timePreference) ) { return false; }
        return this.timePreference.isPinned(item);
    },
    
    _getItemFromRef: function(item_ref) {
        var deferred = Ext.create('Deft.Deferred');
        var ref_array = item_ref.split(/\//);
        
        var objectid = ref_array.pop();
        var type = ref_array.pop();
        
        Rally.data.ModelFactory.getModel({
            type: type,
            success: function(model) {
                model.load(objectid, {
                    fetch: ['Name', 'FormattedID', 'Project','ObjectID','WorkProduct'],
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            deferred.resolve(result);
                        }
                    }
                });
            }
        });
        
        
        return deferred.promise;
    },
    
    cloneForAppending: function(record) {
        var me = this;
        var item = record.get('WorkProduct');
        
        if (! Ext.isEmpty( record.get('Task') ) ) {
            item = record.get('Task');
        }
        
        var type = item._type;
        var objectid = item.ObjectID;
        
        Rally.data.ModelFactory.getModel({
            type: type,
            success: function(model) {
                model.load(objectid, {
                    fetch: ['Name', 'FormattedID', 'Project','ObjectID','WorkProduct',TSUtilities.lowestPortfolioItemTypeName],
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            result.set('__Amended', true);
                            me.addRowForItem(result);
                        }
                    }
                });
            }
        });
    },
    
    getRowForAmendedRow: function(amended_row) {
        this.logger.log('getting item row for', amended_row);
        var work_item = amended_row.Task;
        if ( Ext.isEmpty(work_item) ) {
            work_item = amended_row.WorkProduct;
        }
        
        
        var returnRow = null;
        var rows = [];
        var store_count = this.grid.getStore().data.items.length;  // this.grid.getStore().getTotalCount();
                
        for ( var i=0; i<store_count; i++ ) {
            rows.push(this.grid.getStore().getAt(i));
        }
        
        Ext.Array.each(rows, function(row) {
            if ( row ) { 
                if ( !row.get('__Amended')  && row.get('WorkProduct') ) {
                    var task_oid = row.get('Task') && row.get('Task').ObjectID;
                    var wp_oid = row.get('WorkProduct').ObjectID;
                    
                    if ( task_oid == work_item.ObjectID || wp_oid == work_item.ObjectID ) {
                        returnRow = row;
                    }
                }
            }
        });
        
        return returnRow;
    },
    
    // use force=true to ignore the fact that there's already a row (for appending)
    addRowForItem: function(item,force) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');

        this.logger.log('addRowForItem', item, force);
        
        if ( !force && this._hasRowForItem(item) ) {
            this.logger.log('has row already:', item);
        } else {
            var item_type = item.get('_type');

            var config = {
                WorkProductDisplayString: item.get('FormattedID') + ":" + item.get('Name'),
                WorkProduct: {
                    _refObjectName: item.get('Name'),
                    _ref: item.get('_ref'),
                    ObjectID: item.get('ObjectID')
                },
                WeekStartDate: this.origStartDateString,
                User: { 
                    _ref: '/user/' + this.timesheet_user.ObjectID,
                    ObjectID: this.timesheet_user.ObjectID
                }
            };
            
            if ( item.get('Project') ) {
                config.Project = item.get('Project');
            }
            
            if ( item_type == "task" ) {
                config.TaskDisplayString = item.get('FormattedID') + ":" + item.get('Name');
                config.Task = { 
                    _ref: item.get('_ref'),
                    _refObjectName: config.TaskDisplayString,
                    ObjectID: item.get('ObjectID')
                };
                
                config.WorkProductDisplayString = item.get('WorkProduct').FormattedID + ":" + item.get('WorkProduct').Name;
                
                config.WorkProduct = {
                    _refObjectName: item.get('WorkProduct').Name,
                    _ref: item.get('WorkProduct')._ref,
                    ObjectID: item.get('WorkProduct').ObjectID
                };
            } else if ( item_type == 'defect' ) {
                var requirement = item.get('Requirement');
                if ( requirement ) {
                    config.WorkProductDisplayString = requirement.FormattedID + ":" + requirement.Name;
                    
                    config.WorkProduct = {
                        _refObjectName: requirement.Name,
                        _ref: requirement._ref,
                        ObjectID: requirement.ObjectID
                    };
                }
            }
            
            if ( !this._isForCurrentUser() ) {
                // create a shadow item
                config.ObjectID = -1;
                config._type = "timeentryitem";

                config._refObjectUUID = -1;
                
                var data = {
                    __TimeEntryItem: Ext.create(this.tei_model,config), // TODO (tj) can this remain the non-Sunday date?
                    __Feature: null,
                    __Iteration: config.WorkProduct.Iteration,  // TODO (tj) is Iteration available here?
                    __Product: config.Project,
                    __Release: config.WorkProduct.Release
                };
                
                                
                if ( item.get('__Amended') ) {
                    data.__Amended = true;
                } else {
                    data.__Appended = true;
                }
                
                var row = Ext.create('TSTableRow',Ext.Object.merge(data, config));
                row.save();
                row.set('updatable', true); // so we can add values to the week 

                me.grid.getStore().loadRecords([row], { addRecords: true });

                me.rows.push(row);
                return row;
            } else {
                
                var fetch = Ext.Array.merge(Rally.technicalservices.TimeModelBuilder.getFetchFields(), this.time_entry_item_fetch);
                // TODO (tj) If the startDate is not a Sunday, convert it into two TimeEntryItems
                var savePromises = _.map(this.weekISOStartStrings, function(startDateString) {
                    config.WeekStartDate = startDateString;
                    var timeEntryItem = Ext.create(this.tei_model,config);
                    return timeEntryItem.save({
                        fetch: fetch
                    }).then(function(result){
                        // save() has side effects on the item (particularly on 'updatable'). return the saved result AND the original
                        // item from the promise so that we can use the item late
                        return {
                            savedTimeEntryItem: result,
                            origTimeEntryItem: timeEntryItem
                        }
                    })
                }, this);
                
                Deft.promise.Promise.all(savePromises)
                .then({
                    scope: this,
                    success: function(results) {
                        var result = results[0].savedTimeEntryItem;
                        result.set('WeekStartDate', this.origStartDateString);
                        
                        var product = result.get('Project');
                        var workproduct = result.get('WorkProduct');
                        var feature = null;
                        var release = null;
                        var iteration = null;
                        
                        if ( !Ext.isEmpty(workproduct) ) {
                            if ( workproduct[TSUtilities.lowestPortfolioItemTypeName] ) {
                                feature = workproduct[TSUtilities.lowestPortfolioItemTypeName];
                                product = feature.Project;
                            }
                            
                            if ( workproduct.Release ) {
                                release = workproduct.Release;
                            }
                            
                            if ( workproduct.Iteration ) {
                                iteration = workproduct.Iteration;
                            }
                        }

                        var data = {
                            __TimeEntryItem:result,
                            __Feature: feature,
                            __Iteration: iteration,
                            __Product: product,
                            __Release: release,
                            __Pinned: me._isItemPinned(result) || false
                        };

                        // TODO (tj) get State, Iteration and Estimate here?
                        var row = Ext.create('TSTableRow',Ext.Object.merge(data, results[0].origTimeEntryItem.getData()));

                        
                        me.grid.getStore().loadRecords([row], { addRecords: true });
                        me.rows.push(row);
                        
                        deferred.resolve(row);
                    },
                    failure: function() {
                        console.log("ERROR:", operation);
                        Ext.Msg.alert("Problem saving time:", operation.error.errors.join(' '));
                        deferred.reject();
                    }
                });
            }
        }
        
        return deferred.promise;
    },
    
    _hasRowForItem: function(item) {
        var item_type = item.get('_type');
        var amender = item.get('__Amended');
        
        var hasRow = false;
        var rows = [];
        var store_count = this.grid.getStore().data.items.length;
                
        for ( var i=0; i<store_count; i++ ) {
            rows.push(this.grid.getStore().getAt(i));
        }
        
        Ext.Array.each(rows, function(row) {
            if ( row ) { // when clear and remove, we get an undefined row
                if ( item_type == "task" ) {
                    if ( row.get('Task') && row.get('Task')._ref == item.get('_ref') ) {
                        if ( amender && row.get('__Amended') || !amender ) {
                            hasRow = true;
                        }
                    }
                } else {
                    if ( Ext.isEmpty(row.get('Task')) && row.get('WorkProduct') && row.get('WorkProduct')._ref == item.get('_ref') ) {
                        if ( amender && row.get('__Amended') || !amender ) {
                            hasRow = true;
                        }
                    }
                }
            }
        });
        
        return hasRow;
    },
    
    getColumns: function() {
        var me = this;

        this.logger.log('saved columns:', this.columns);
        
        var columns = [];
        var isForModification = ! this._isForCurrentUser();
        
        if ( this.week_locked ) {
            isForModification = false;
        }
        
        if ( this.editable ||  isForModification ) {
            columns.push({
                xtype: 'tstimetablerowactioncolumn',
                forModification: isForModification,
                _csvIgnoreRender: true
            });
        }
            
        Ext.Array.push(columns, [
            {
                dataIndex: '__TimeEntryItem',
                text: 'User',
                editor: null,
                hidden: true,
                _selectable: false,
                renderer: function(value) {
                    return value.get('User').UserName;
                }
            },
            {
                dataIndex: '__TimeEntryItem',
                text: 'Week Start',
                editor: null,
                hidden: true,
                _selectable: false,
                renderer: function(value) {
                    return value.get('WeekStartDate');
                }
            },
            {
                dataIndex: '__TimeEntryItem',
                text: 'Locked',
                editor: null,
                hidden: true,
                _selectable: false,
                renderer: function(value, meta, record) {
                    return record.isLocked() || false;
                }
            }]);
            
        if ( me.manager_field ) {
            columns.push({
                dataIndex:'__TimeEntryItem', 
                text:'Manager', 
                align: 'center',
                hidden: true,
                _selectable: false,
                renderer: function(value) {
                    return value.get('User')[me.manager_field] || "none"; 
                }
            });
        }
        if ( me.timesheet_status || me.timesheet_status === false ) {
            Ext.Array.push(columns,[{
                dataIndex: '__Product',
                text: 'Status',
                _selectable: true,
                renderer: function(v) { return me.timesheet_status; }
            }]);
        }
        
        Ext.Array.push(columns, [
            { 
                text: '',
                width: 25,
                _selectable: false,
                renderer: function(value,meta,record) {
                    var display_string = "";
                    
                    if ( record.isLocked() ) {
                        display_string += "<span class='icon-lock'> </span>";
                    }
                    
                    if ( record.get('__Appended') ) {
                        display_string += "<span class='red icon-edit'> </span>";
                    }
                    
                    if ( record.get('__Amended') ) {
                        display_string += "<span class='red icon-history'> </span>";
                    }
                    
                    return display_string;
                },
                _csvIgnoreRender: true
            },
            {
                dataIndex: '__Product',
                text: 'Product',
                _selectable: true,
                flex: 1,
                editor: null,
                renderer: function(value,meta,record) {
                    if ( Ext.isEmpty(value) ) { 
                        return "";
                    }
                    return value._refObjectName;
                },
                summaryRenderer: function() {
                    return "Totals";
                }
            },
            {
                dataIndex: '__Feature',
                text:  TSUtilities.lowestPortfolioItemTypeName,
                flex: 1,
                editor: null,
                _selectable: true,
                renderer: function(value) {
                    if ( Ext.isEmpty(value) ) { return ""; }
                    //console.log(value);
                    return Ext.String.format("<a target='_blank' href='{0}'>{1}</a>",
                        Rally.nav.Manager.getDetailUrl(value),
                        value._refObjectName
                    );
                },
                exportRenderer: function(value,meta,record) {
                    if ( Ext.isEmpty(value) ) { return ""; }
                    return value._refObjectName
                }
            }],
            Ext.Array.map(TSUtilities.fetchManagerPortfolioItemFields, function( fieldName ) {
                var displayName = fieldName;
                if ( this.portfolio_item_model ) {
                    var modelField = this.portfolio_item_model.getField(fieldName);
                    if ( modelField ) {
                        displayName = modelField.displayName;
                    }
                }

                return {
                    text: TSUtilities.lowestPortfolioItemTypeName + ' ' + displayName,
                    xtype: 'templatecolumn',
                    sortable: false,
                    tpl: '{__Feature.' + fieldName + '}',
                    flex: 1,
                    editor: null,
                    _selectable: true
                }
            }, this),
            [{
                dataIndex: 'WorkProduct',
                text:  'Work Product',
                flex: 1,
                editor: null,
                _selectable: true,
                renderer: function(value, meta, record) {
                    if ( Ext.isEmpty(value) ) {
                        return record.get('WorkProductDisplayString');
                    }
                    
                    return Ext.String.format("<a target='_blank' href='{0}'>{1}</a>",
                        Rally.nav.Manager.getDetailUrl(value),
                        record.get('WorkProductDisplayString')
                    );
                },
                exportRenderer: function(value,meta,record) {
                    return record.get('WorkProductDisplayString')
                }
            },
            {
                text: 'Work Product Estimate',
                xtype: 'templatecolumn',
                sortable: false,
                tpl: '{WorkProduct.PlanEstimate}',
                _selectable: true,
                flex: 1,
                editor: null,
            },
            {
                text: 'Work Product Schedule State',
                xtype: 'templatecolumn',
                sortable: false,
                tpl: '{WorkProduct.ScheduleState}',
                _selectable: true,
                flex: 1,
                editor: null,
            },
            {
                dataIndex: 'Task',
                text:  'Task',
                flex: 1,
                editor: null,
                _selectable: true,
                renderer: function(value, meta, record) {
                    if ( Ext.isEmpty(value) ) {
                        return record.get('TaskDisplayString');
                    }
                    
                    return Ext.String.format("<a target='_blank' href='{0}'>{1}</a>",
                        Rally.nav.Manager.getDetailUrl(value),
                        record.get('TaskDisplayString')
                    );
                },
                exportRenderer: function(value,meta,record) {
                    return record.get('TaskDisplayString')
                }
            },
            {
                text: 'Task Estimate',
                xtype: 'templatecolumn',
                sortable: false,
                tpl: '{Task.Estimate}',
                _selectable: true,
                flex: 1,
                editor: null,
            },
            {
                text: 'Task State',
                xtype: 'templatecolumn',
                sortable: false,
                tpl: '{Task.State}',
                _selectable: true,
                flex: 1,
                editor: null,
            },
            {
                dataIndex: '__Release',
                text: 'Release',
                flex: 1,
                editor: null,
                _selectable: true,
                renderer: function(v) {
                    if ( Ext.isEmpty(v) ) { return ""; }
                    return v._refObjectName;
                }
            },
            {
                text: 'Iteration',
                xtype: 'templatecolumn',
                dataIndex: '__Iteration',
                tpl: '{WorkProduct.Iteration.Name}',
                _selectable: true,
                flex: 1,
                editor: null
            },
        ]);
        
        var day_width = 50;
        
        var editor_config = function(record,df){
                        
            if( record && record.isLocked() ) {
                return false;
            }
            
            var minValue = 0;
            
            if ( record && record.get('__Amended') ) {
                minValue = -24;
            }

            var disabled = !me.editable;
            if ( record && ( record.get('__Appended') || record.get('__Amended') ) ) {
                disabled = false;
            }
            
            return Ext.create('Ext.grid.CellEditor', {
                field: Ext.create('Rally.ui.NumberField', {
                    xtype:'rallynumberfield',
                    minValue: minValue,
                    maxValue: 24,
                    disabled: disabled,
                    selectOnFocus: true,
                    listeners: {
                        change: function(field, new_value, old_value) {1
                            if ( Ext.isEmpty(new_value) ) {
                                field.setValue(0);
                            }
                        }
                    }
                })
            });
            
        };

        _.each(TSDateUtils.getDaysOfWeek(), function(day) {
            columns.push({
                dataIndex: Ext.String.format('__{0}', day),
                width: day_width,
                resizable: false,
                _selectable: true,
                text: day.substr(0, 3), // Sun, Mon, etc.
                align: 'center',
                getEditor: editor_config,
                summaryType: 'sum',
                field: {},
                tdCls: day.toLowerCase()
            });
        });
        
        columns.push({
            dataIndex:'__Total',
            width: day_width, resizable: false, 
            text:'Total', 
            align: 'center',
            editor: null,
            _selectable: true,
            summaryType: 'sum',
            summaryRenderer: function(value,meta,record) {
                if ( value < 40 ) {
                    meta.tdCls = 'total not-enough-hours'
                }
                return value;
            },
            tdCls: 'ts-total-cell'
        });

        this.columns = this._applyUnsavableColumnAttributes(columns);
        
        return this.columns;
    },
    
    _applyUnsavableColumnAttributes: function(columns) {
        console.log('_applyUnsavableColumnAttributes', columns, this.columns);
        if ( !Ext.isEmpty(this.columns) ) {
            // columns saved as state lose their renderer functions
            var columns_by_index = {};
            Ext.Array.each(columns, function(column) {
                columns_by_index[column.dataIndex] = column;
            });
            
            Ext.Array.each(this.columns, function(column){
                var cfg = columns_by_index[column.dataIndex];
                if ( column.width && column.width > 0 ) {
                    column.flex = null;
                }
                if ( cfg && cfg.renderer ) {
                    column.renderer = cfg.renderer;
                }
                if ( cfg && cfg.summaryRenderer ) {
                    column.summaryRenderer = cfg.summaryRenderer;
                }
                
                if ( cfg && cfg.editor ) {
                    column.editor = cfg.editor;
                }
                
                                
                if ( cfg && cfg.getEditor ) {
                    column.getEditor = cfg.getEditor;
                }
                
                if ( cfg && cfg.summaryType ) {
                    column.summaryType = cfg.summaryType;
                }
                
                if ( cfg && cfg.exportRenderer ) {
                    column.exportRenderer = cfg.exportRenderer;
                }
                
                if ( cfg && cfg._selectable ) {
                    column._selectable = cfg._selectable;
                }
            
            });
            
            console.log('-->', this.columns);
            return this.columns;
        }
        
        return columns;
        
    },
    
    getGrid: function() {
        return this.down('rallygrid');
    }
    

});
