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
                
                base_fields.push({ name: '__TimeEntryItem', type:'object' });
                
                var day_fields = this._getDayFields();
                
                var all_fields = Ext.Array.merge(base_fields, day_fields);

                console.log('all_fields', all_fields);
                
                var new_model = Ext.define(newModelName, {
                    extend: 'Ext.data.Model',
                    fields: all_fields,
                    addTimeEntryValue: this._addTimeEntryValue
                });
                deferred.resolve(new_model);
            }
        });
        return deferred;
    },

    _addTimeEntryValue: function(value_item) {
        var value_day = value_item.get('DateVal').getUTCDay();
        var value_hours = value_item.get('Hours');
        
        var value_day_name = Rally.technicalservices.TimeModelBuilder.days[value_day];
        
        var day_number_field_name = Rally.technicalservices.TimeModelBuilder._getDayNumberFieldName(value_day_name);
        var day_record_field_name = Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(value_day_name);
        
        this.set(day_number_field_name, value_hours);
        this.set(day_record_field_name, value_item);
    },
    
    _getDayNumberFieldName: function(day_name) {
        return Ext.String.format('__{0}',day_name);
    },
    
    _getDayRecordFieldName: function(day_name) {
        return Ext.String.format('__{0}_record',day_name);
    },
    
    _getDayFields: function() {
        var me = this;
        
        var day_number_fields =  Ext.Array.map(this.days, function(day) {
            return {
                name: me._getDayNumberFieldName(day),
                type: 'auto',
                defaultValue: 0
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