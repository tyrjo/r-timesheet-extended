Ext.define('Rally.technicalservices.TimeModelBuilder',{
    singleton: true,

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
                    { name: '__Feature', type: 'object' },
                    { name: '__Release', type: 'object' },
                    { name: '__Product', type: 'object' },
                    { name: '__Total',   type: 'float', defaultValue: 0 }
                ];
                
                var day_fields = this._getDayFields();
                
                var all_fields = Ext.Array.merge(base_fields, day_fields, related_fields);
                
                var new_model = Ext.define(newModelName, {
                    extend: 'Ext.data.Model',
                    fields: all_fields,
                    addTimeEntryValue: this._addTimeEntryValue,
                    _updateTotal: this._updateTotal,
                    _days: this.days,
                    save: function(v) { 
                        var me = this;
                        var changes = this.getChanges();
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
                                    // TODO: check for over 24 hours total
                                    src.save();
                                    me._updateTotal();
                                } else {
                                    // need to create a new record
                                    var time_entry_item = this.get('__TimeEntryItem');
                                    var index = field.__index;
                                    var week_start = time_entry_item.get('WeekStartDate');
                                    var date_val = Rally.util.DateTime.add(week_start, 'day', index);
                                    
                                    Rally.data.ModelFactory.getModel({
                                        type: 'TimeEntryValue',
                                        scope: this,
                                        success: function(tev_model) {
                                            var fields = tev_model.getFields();
                                            Ext.Array.each(fields, function(field) {
                                                if ( field.name == "TimeEntryItem" || field.name == "DateVal") {
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
                                        }
                                    });
                                }
                            }
                        },this);
                    },
                    getField: this.getField
                });
                
                this.model = new_model;
                
                deferred.resolve(new_model);
            }
        });
        return deferred;
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
        
    },
    
    // sometimes, dates are provided as beginning of day, but we 
    // want to go to the end of the day
    shiftToEndOfDay: function(js_date) {
        return Rally.util.DateTime.add(Rally.util.DateTime.add(js_date,'day',1),'second',-1);
    }
});