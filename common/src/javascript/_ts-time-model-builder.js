Ext.define('Rally.technicalservices.TimeModelBuilder',{
    singleton: true,

    deploy_field: 'c_IsDeployed',
    
    appendKeyPrefix: 'rally.technicalservices.timesheet.append',
    amendKeyPrefix: 'rally.technicalservices.timesheet.amend',

    days: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    
    build: function(modelType, newModelName) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: modelType,
            scope: this,
            success: function(model) {
                var base_fields = model.getFields();
                
                var related_fields = [
                    { name: '__TimeEntryItem', type:'object' },
                    { name: '__Feature',   type: 'object' },
                    { name: '__Release',   type: 'object' },
                    { name: '__Product',   type: 'object' },
                    { name: '__Total',     type: 'float', defaultValue: 0 },
                    { name: '__SecretKey', type:'auto', defaultValue: 1 },
                    { name: '__Appended', type: 'boolean', defaultValue: false },
                    { name: '__Amended', type: 'boolean', defaultValue: false },
                    { name: '__PrefID', type:'auto', defaultValue: -1 },
                    { name: '_ReleaseLockFieldName',  type:'string', defaultValue: Rally.technicalservices.TimeModelBuilder.deploy_field },
                    { name: '__Pinned', type: 'boolean' }
                ];
                
                var day_fields = this._getDayFields();
                
                var all_fields = Ext.Array.merge(base_fields, day_fields, related_fields);
                
                var new_model = Ext.define(newModelName, {
                    extend: 'Ext.data.Model',
                    fields: all_fields,
                    addTimeEntryValue: this._addTimeEntryValue,
                    _updateTotal: this._updateTotal,
                    _days: this.days,
                    save: this._save,
                    _saveAsPref: this._saveAsPref,
                    _savePreference: this._savePreference,
                    getField: this.getField,
                    clearAndRemove: this.clearAndRemove,
                    isLocked: this._isLocked,
                    isPinned: this._isPinned,
                    _saveTEV: this._saveTEV,
                    _createTEV: this._createTEV
                });
                
                this.model = new_model;
                
                deferred.resolve(new_model);
            }
        });
        return deferred;
    },
    
    getFetchFields: function() {
        return [ 'ObjectID', 'Name', 'Release', 'User', 'UserName', this.deploy_field ];
    },
    
    _isPinned: function() {
        return this.get('__Pinned');
    },
    
    _isLocked: function (fieldName, newValue) {
        var release = this.get('__Release');
        var lock_field_name = this.get('_ReleaseLockFieldName');
                
        if ( Ext.isEmpty(release) || Ext.isEmpty(lock_field_name) ) {
            return false;
        }
        
        return release[lock_field_name];
    },
    
    clearAndRemove: function() {        
        var timeentryitem = this.get('__TimeEntryItem');
        var cells_to_clear = ['__Monday','__Tuesday','__Wednesday','__Thursday','__Friday','__Saturday','__Sunday','__Total'];
        var me = this;
                
        var key = Ext.String.format("{0}.{1}.{2}.{3}", 
            TSUtilities.deletionKeyPrefix,
            TSDateUtils.formatShiftedDate(this.get('WeekStartDate'),'Y-m-d'),
            this.get('User').ObjectID,
            new Date().getTime()
        );
                
        var data = this.getData();
        
        delete data.__TimeEntryItem;
        
        Ext.Array.each(cells_to_clear, function(cell_to_clear) {
            delete data[cell_to_clear + "_record"];
        });

        var value = Ext.JSON.encode(data);
                
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {

                var pref_config = {
                    Name: key,
                    Value: value,
                    Project: TSUtilities.getPreferenceProject()
                }

                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(deleted_pref, operation) {                        
                        if(operation.wasSuccessful()) {
                            Ext.Array.each(cells_to_clear, function(cell_to_clear){
                                me.set(cell_to_clear,0);
                            },me);
                            
                            if ( me.get('__PrefID') > 0 ) {
                                // destroy the preference
                                var oid = me.get('__PrefID');
                                
                                Rally.data.ModelFactory.getModel({
                                    type: 'Preference',
                                    success: function(model) {
                                        model.load(oid, {
                                            fetch: ['Name', 'ObjectID', 'Value'],
                                            callback: function(result, operation) {
                                                if(operation.wasSuccessful()) {
                                                    result.destroy();
                                                }
                                            }
                                        });
                                    }
                                });
                                
                            } else {
                                console.log("Does not have an existing pref ID", this);
                                if ( ! Ext.isEmpty(timeentryitem) && timeentryitem.data.ObjectID > 0 ){
                                    timeentryitem.destroy();
                                }
                            }
                            me.destroy();
                        } else {
                            Ext.Msg.alert('Problem removing', operation.error.errors[0]);
                        }
                    }
                });
            }
        });
    },
    
    _saveAsPref: function() {
        var me = this;
        var item = this.get('Task') || this.get('WorkProduct');
        var prefix = Rally.technicalservices.TimeModelBuilder.appendKeyPrefix;
        if ( this.get('__Amended') ) {
            prefix = Rally.technicalservices.TimeModelBuilder.amendKeyPrefix;
        }
        var key = Ext.String.format("{0}.{1}.{2}.{3}", 
            prefix,
            TSDateUtils.formatShiftedDate(this.get('WeekStartDate'),'Y-m-d'),
            this.get('User').ObjectID,
            item.ObjectID
        );
        
        var value = Ext.JSON.encode(this.getData());
        var project_oid = this.get('Project').ObjectID;
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {

                var pref_config = {
                    Name: key,
                    Value: value,
                    Project: TSUtilities.getPreferenceProject()
                }

                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            me.set('ObjectID', result.get('ObjectID'));
                            me.set('__PrefID', result.get('ObjectID'));
                        } else {
                            Ext.Msg.alert('Problem amending', operation.error.errors[0]);
                        }
                    }
                });
            }
        });
    },
    
    _savePreference: function(changes) {
        var oid = this.get('__PrefID');
        var me = this;
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {
                model.load(oid, {
                    fetch: ['Name', 'ObjectID', 'Value'],
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            result.set('Value', Ext.JSON.encode(me.getData()));
                            result.save({
                                callback: function(result, operation) {
                                    if(operation.wasSuccessful()) {
                                        console.log('saved:', me);
                                    } else {
                                        Ext.Msg.alert('Problem saving change', operation.error.errors[0]);
                                    }
                                }
                            });
                        }
                    }
                });
            }
        });
        
    },
    
    _saveTEV: function(src) {
        var deferred = Ext.create('Deft.Deferred');

        src.save({
            callback: function() {
                deferred.resolve();
            }
        });
        return deferred.promise;
    },
    
    _createTEV: function(src_field_name, row, time_entry_item, index, value, week_start, date_val) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        Rally.data.ModelFactory.getModel({
            type: 'TimeEntryValue',
            scope: this,
            success: function(tev_model) {
                var fields = tev_model.getFields();
                Ext.Array.each(fields, function(field) {
                    if ( field.name == "TimeEntryItem" || field.name == "DateVal" ) {
                        field.readOnly = false;
                        field.persist = true;
                    }
                });
                src = Ext.create(tev_model,{
                    Hours: value,
                    TimeEntryItem: { _ref: time_entry_item.get('_ref') },
                    DateVal: date_val
                });
                                
                src.save({
                    callback: function(result, operation) {
                        
                        if(operation.wasSuccessful()) {
                            row.set(src_field_name, result);
                            me._updateTotal();
                        }
                    }
                });

                deferred.resolve();    
            }
        });
        
        return deferred.promise;
    },
    
    _save: function(v) { 
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
            
        var changes = this.getChanges();

        if ( ( this.get('__Amended') || this.get('__Appended') ) && this.get('ObjectID') == -1 ) {
            this._saveAsPref();
        }
        
        if ( this.get('__Appended') || this.get('__Amended') ) {
            this._savePreference(changes);
            return;
        }
                
        var promises = [];
        
        Ext.Object.each(changes, function(field_name, value) {
            var row = this;
            var field = row.getField(field_name);
            var src_field_name = field.__src;
            
            if ( ! Ext.isEmpty(src_field_name) ) {
                // this is a field that belongs to another record
                var src = this.get(src_field_name);
                if ( !Ext.isEmpty(src) ) {
                    // the other record exists
                    src.set('Hours', value);
                    // TODO: check for errors on return 
                    me._updateTotal();
                    
                    promises.push(function() { return me._saveTEV(src) });
                    
                } else {
                    // need to create a new record
                    var time_entry_item = this.get('__TimeEntryItem');
                    var index = field.__index;
                    var week_start = time_entry_item.get('WeekStartDate');
                    var date_val = Rally.util.DateTime.add(week_start, 'day', index);
                    
                    promises.push(function() { return me._createTEV(src_field_name, row, time_entry_item, index, value, week_start, date_val); });
                    
                }
            }
        },this);
                
        if ( promises.length === 0 ) { 
            deferred.resolve(); 
            return deferred;
        }
        Deft.Chain.sequence(promises).then({
            success: function(result) {                
                deferred.resolve(result);
            },
            failures: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
        
    },
    
    getField: function(field_name) {
        var fields = this.fields.items;
        var field = null;
        
        Ext.Array.each(fields, function(f) {
            if ( f.name == field_name || f.displayName == field_name ) {
                field = f;
            }
        });
        return field;
    },
    
    _updateTotal: function() {
        var total = 0;
        Ext.Array.each(this._days, function(day){
            var value = this.get(Ext.String.format('__{0}',day)) || 0;
            total += value;
        },this);
        this.set('__Total', total);
    },
    
    _addTimeEntryValue: function(value_item) {
        var value_day = value_item.get('DateVal').getUTCDay();
        var value_hours = value_item.get('Hours');
        
        var value_day_name = Rally.technicalservices.TimeModelBuilder.days[value_day];
        
        var day_number_field_name = Rally.technicalservices.TimeModelBuilder._getDayNumberFieldName(value_day_name);
        var day_record_field_name = Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(value_day_name);
        
        this.set(day_number_field_name, value_hours);
        this.set(day_record_field_name, value_item);
        
        this._updateTotal();
        
        // don't try to write these back when we're first getting them out of the system
        this.dirty = false;
        this.modified = [];
    },
    
    _getDayNumberFieldName: function(day_name) {
        return Ext.String.format('__{0}',day_name);
    },
    
    _getDayRecordFieldName: function(day_name) {
        return Ext.String.format('__{0}_record',day_name);
    },
    
    _getDayFields: function() {
        var me = this;
        
        var day_number_fields =  Ext.Array.map(this.days, function(day,idx) {
            return {
                name: me._getDayNumberFieldName(day),
                type: 'auto',
                defaultValue: 0,
                __src: me._getDayRecordFieldName(day),
                __index: idx
            }
        });
        
        var day_record_fields =  Ext.Array.map(this.days, function(day) {
            return {
                name: me._getDayRecordFieldName(day),
                type: 'object',
                defaultValue: null
            }
        });
        
        return Ext.Array.merge(day_number_fields, day_record_fields);
        
    }
});