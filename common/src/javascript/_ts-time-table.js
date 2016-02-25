Ext.override(Ext.grid.plugin.CellEditing, {
    onSpecialKey: function(ed, field, e) {
        var sm;
 
        if (e.getKey() === e.TAB) {
            e.stopEvent();

            if (ed) {
                // Allow the field to act on tabs before onEditorTab, which ends
                // up calling completeEdit. This is useful for picker type fields.
                ed.onEditorTab(e);
            }

            sm = ed.up('tablepanel').getSelectionModel();
            console.log('--', sm);
            if (sm.onEditorTab) {
                return sm.onEditorTab(ed.editingPlugin, e);
            }
        }
    }
})

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
    
    logger: new Rally.technicalservices.Logger(),

    rows: [],
    
    /**
     * @property {String} cls The base class applied to this object's element
     */
    cls: "tstimetable",

    time_entry_item_fetch: ['WeekStartDate','WorkProductDisplayString','WorkProduct','Task',
        'TaskDisplayString','Feature','Project', 'ObjectID', 'Name', 'Release'],
        
    config: {
        startDate: null,
        editable: true,
        timesheet_user: null,
        timesheet_status: null,
        manager_field: null,
        week_locked: false
    },
    
    constructor: function (config) {
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
        
        this.startDateString = TSDateUtils.getBeginningOfWeekISOForLocalDate(this.startDate, true);

        this.logger.log("Week Start: ", this.startDate, this.startDateString );
        
        if ( Ext.isEmpty(this.timesheet_user) ) {
            this.timesheet_user = Rally.getApp().getContext().getUser();
        }
        
        
        Deft.Chain.sequence([
            me._getTEIModel,
            function() { return Rally.technicalservices.TimeModelBuilder.build('TimeEntryItem','TSTableRow'); }
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

        Deft.Chain.sequence([
            this._loadTimeEntryItems,
            this._loadTimeEntryValues,
            this._loadTimeEntryAppends,
            this._loadTimeEntryAmends
        ],this).then({
            scope: this,
            success: function(results) {
                var time_entry_items  = results[0];
                var time_entry_values = results[1];
                var time_entry_appends = results[2];
                var time_entry_amends = results[3];
                
                var rows = Ext.Array.map(time_entry_items, function(item){
                    var product = item.get('Project');

                    var workproduct = item.get('WorkProduct');
                    var feature = null;
                    var release = null;
                    
                    if ( !Ext.isEmpty(workproduct) ) {
                        product = workproduct.Project;
                        if ( workproduct.Feature ) {
                            feature = workproduct.Feature;
                            product = feature.Project;
                        }
                    }
                    
                    if ( !Ext.isEmpty(workproduct) && workproduct.Release ) {
                        release = workproduct.Release;
                    }
                    
                    var data = {
                        __TimeEntryItem:item,
                        __Feature: feature,
                        __Product: product,
                        __Release: release
                    };
                    
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
    
    _getAppendedRowsFromPreferences: function(prefs) {
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
    
    _loadTimeEntryItems: function() {
        this.setLoading('Loading time entry items...');

        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }

        var config = {
            model: 'TimeEntryItem',
            context: {
                project: null
            },
            fetch: Ext.Array.merge(Rally.technicalservices.TimeModelBuilder.getFetchFields(), 
                this.time_entry_item_fetch,
                [this.manager_field]
            ),
            filters: [
                {property:'WeekStartDate',value:this.startDateString},
                {property:'User.ObjectID',value:user_oid}
            ]
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadTimeEntryValues: function() {
        this.setLoading('Loading time entry values...');
        
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var config = {
            model: 'TimeEntryValue',
            context: {
                project: null
            },
            fetch: ['DateVal','Hours','TimeEntryItem','ObjectID'],
            filters: [
                {property:'TimeEntryItem.WeekStartDate',value:this.startDateString},
                {property:'TimeEntryItem.User.ObjectID',value:user_oid}
            ]
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadTimeEntryAppends: function() {
        this.setLoading('Loading time entry additions...');
        
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var key = Ext.String.format("{0}.{1}.{2}", 
            Rally.technicalservices.TimeModelBuilder.appendKeyPrefix,
            this.startDateString.replace(/T.*$/,''),
            user_oid
        );
        
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
    
    _loadTimeEntryAmends: function() {
        this.setLoading('Loading time entry amendments...');
        
        var user_oid = Rally.getApp().getContext().getUser().ObjectID;
        
        if ( !Ext.isEmpty(this.timesheet_user) ) {
            user_oid = this.timesheet_user.ObjectID;
        }
        
        var key = Ext.String.format("{0}.{1}.{2}", 
            Rally.technicalservices.TimeModelBuilder.amendKeyPrefix,
            this.startDateString.replace(/T.*$/,''),
            user_oid
        );
        
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
            data: rows
        });
                
        
        var me = this;
                
        this.grid = this.add({ 
            xtype:'rallygrid', 
            store: table_store,
            columnCfgs: this._getColumns(),
            showPagingToolbar : false,
            showRowActionsColumn : false,
            sortableColumns: false,
            disableSelection: true,
            enableColumnMove: false,
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
            }]
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
                    
                    if ( columnTitle == "Work Product" ) {
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
        console.log('absorb!', record);
        var me = this;
        
        var clone = Ext.clone(record).getData();
        record.clearAndRemove();

        if ( clone.__Appended ) {
            this._absorbAppended(clone);
        } else {
            var original_row = this.getRowForAmendedRow(clone);
            
            console.log('original row', original_row);
            
            if ( ! Ext.isEmpty(original_row) ) {
                var days = ['__Monday','__Tuesday','__Wednesday','__Thursday','__Friday','__Saturday','__Sunday','__Total'];
    
                //var days = me._getDayValuesFromRow(clone);
                Ext.Array.each(days, function(day) {
                    var clone_value = clone[day] || 0;
                    var original_value = original_row.get(day) || 0;
                    
                    var new_value = original_value + clone[day];
                    if ( new_value < 0 ) { new_value = 0; }
                    if ( new_value > 24 ) { new_value = 24; }
                    
                    original_row.set(day,new_value);
                });
                original_row.save();
            } else {
                this._absorbAppended(clone); // original must have been removed
            }
        }
    },
    
    _absorbAppended: function(clone) {
        var me = this;
        var work_item = clone.Task;
            
        if ( Ext.isEmpty(work_item) ) {
            work_item = clone.WorkProduct;
        }
        
        this._getItemFromRef(work_item._ref).then({
            success: function(item) {
                me.addRowForItem(item).then({
                    scope:this,
                    success: function(row) {
                        var days = ['__Monday','__Tuesday','__Wednesday','__Thursday','__Friday','__Saturday','__Sunday','__Total'];

                        //var days = me._getDayValuesFromRow(clone);
                        Ext.Array.each(days, function(day) {
                            if ( clone[day] > 0 ) {
                                row.set(day,clone[day]);
                            }
                        });
                        row.save();
                    },
                    failure: function() {
                        
                    }
                });
            }
        });
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
                    fetch: ['Name', 'FormattedID', 'Project','ObjectID','WorkProduct','Feature'],
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
        console.log('getting item row for', amended_row);
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
                if ( !row.get('__Amended') ) {
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
    
    addRowForItem: function(item) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');

        console.log('addRowForItem', item);
        
        if (  this._hasRowForItem(item)) {
            console.log('has row already:', item);
        } else {
            var item_type = item.get('_type');

            var config = {
                WorkProduct: {
                    _refObjectName: item.get('FormattedID') + ":" + item.get('Name'),
                    _ref: item.get('_ref'),
                    ObjectID: item.get('ObjectID')
                },
                WeekStartDate: this.startDateString,
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
                    _refObjectName: config.WorkProductDisplayString,
                    _ref: item.get('WorkProduct')._ref,
                    ObjectID: item.get('WorkProduct').ObjectID
                };
            }
            
            if ( !this._isForCurrentUser() ) {
                console.log("Creating a shadow item");
                // create a shadow item
                config.ObjectID = -1;
                config._type = "timeentryitem";

                config._refObjectUUID = -1;
                
                var data = {
                    __TimeEntryItem: Ext.create(this.tei_model,config),
                    __Feature: null,
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
                console.log('Add item');
                var fields = this.tei_model.getFields();

                var time_entry_item = Ext.create(this.tei_model,config);
                
                var fetch = Ext.Array.merge(Rally.technicalservices.TimeModelBuilder.getFetchFields(), this.time_entry_item_fetch);

                time_entry_item.save({
                    fetch: fetch,
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            var product = result.get('Project');
                            var workproduct = result.get('WorkProduct');
                            var feature = null;
                            var release = null;
                            
                            if ( !Ext.isEmpty(workproduct) && workproduct.Feature ) {
                                feature = workproduct.Feature;
                                product = feature.Project;
                            }
                                                            
                            if ( !Ext.isEmpty(workproduct) && workproduct.Release ) {
                                release = workproduct.Release;
                            }

                            var data = {
                                __TimeEntryItem:result,
                                __Feature: feature,
                                __Product: product,
                                __Release: release
                            };

                            var row = Ext.create('TSTableRow',Ext.Object.merge(data, time_entry_item.getData()));

                            me.grid.getStore().loadRecords([row], { addRecords: true });
                            me.rows.push(row);
                            deferred.resolve(row);
                        } else {
                            if ( operation.error && operation.error.errors ) {
                                Ext.Msg.alert("Problem saving time:", operation.error.errors.join(' '));
                                deferred.reject();
                            }
                        }
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
        var store_count = this.grid.getStore().data.items.length;  // this.grid.getStore().getTotalCount();
                
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
    
    _getColumns: function(task_states) {
        var me = this;
                
        var columns = [];
        var isForModification = ! this._isForCurrentUser();
        
        if ( this.week_locked ) {
            isForModification = false;
        }
        
        if ( this.editable ||  isForModification ) {
            columns.push({
                xtype: 'tstimetablerowactioncolumn',
                forModification: isForModification
            });
        } 
            
        Ext.Array.push(columns, [
            {
                dataIndex: '__TimeEntryItem',
                text: 'User',
                editor: null,
                hidden: true,
                renderer: function(value) {
                    return value.get('User').UserName;
                }
            },
            {
                dataIndex: '__TimeEntryItem',
                text: 'Week Start',
                editor: null,
                hidden: true,
                renderer: function(value) {
                    return value.get('WeekStartDate');
                }
            },
            {
                dataIndex: '__Product',
                text: 'Locked',
                editor: null,
                hidden: true,
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
                renderer: function(value) {
                    return value.get('User')[me.manager_field] || "none"; 
                }
            });
        }
        if ( me.timesheet_status || me.timesheet_status === false ) {
            Ext.Array.push(columns,[{
                dataIndex: '__Product',
                text: 'Status',
                renderer: function(v) { return me.timesheet_status; }
            }]);
        }
        
        Ext.Array.push(columns, [
            {
                dataIndex: '__Product',
                text: 'Product',
                flex: 1,
                editor: null,
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
                    
                    
                    if ( !Ext.isEmpty(value) ) {
                        display_string += value._refObjectName;
                    }

                    return display_string;
                },
                exportRenderer: function(value,meta,record) {
                    return value._refObjectName
                },
                summaryRenderer: function() {
                    return "Totals";
                }
            },
            {
                dataIndex: '__Feature',
                text:  'Feature',
                flex: 1,
                editor: null,
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
            },
            {
                dataIndex: 'WorkProduct',
                text:  'Work Product',
                flex: 1,
                editor: null,
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
                dataIndex: '__Release',
                text: 'Release',
                flext: 1,
                editor: null,
                renderer: function(v) {
                    if ( Ext.isEmpty(v) ) { return ""; }
                    return v._refObjectName;
                }
            },
            {
                dataIndex: 'Task',
                text:  'Task',
                flex: 1,
                editor: null,
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
            }
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

            console.log(record, minValue);

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
        
        var weekend_renderer = function(value, meta, record) {
            meta.tdCls = "ts-weekend-cell";
            return value;
        };
        var total_renderer = function(value, meta, record) {
            meta.tdCls = "ts-total-cell";
            return value;
        }; 
        
        columns.push({dataIndex:'__Sunday',   width: day_width, text:'Sun',   align: 'center',
            getEditor: editor_config, summaryType: 'sum', renderer: weekend_renderer});
        columns.push({dataIndex:'__Monday',   width: day_width, text:'Mon',   align: 'center',
            getEditor: editor_config, summaryType: 'sum'});
        columns.push({dataIndex:'__Tuesday',  width: day_width, text:'Tue',   align: 'center',
            getEditor: editor_config, summaryType: 'sum'});
        columns.push({dataIndex:'__Wednesday',width: day_width, text:'Wed',   align: 'center',
            getEditor: editor_config, summaryType: 'sum'});
        columns.push({dataIndex:'__Thursday', width: day_width, text:'Thur',  align: 'center',
            getEditor: editor_config, summaryType: 'sum'});
        columns.push({dataIndex:'__Friday',   width: day_width, text:'Fri',   align: 'center',
            getEditor: editor_config, summaryType: 'sum'});
        columns.push({dataIndex:'__Saturday', width: day_width, text:'Sat',   align: 'center',
            getEditor: editor_config, summaryType: 'sum', renderer: weekend_renderer});
        columns.push({dataIndex:'__Total',    width: day_width, text:'Total', align: 'center',
            editor: null,summaryType: 'sum', renderer: total_renderer});

        
        return columns;
    },
    
    getGrid: function() {
        return this.down('rallygrid');
    }

});
