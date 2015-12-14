Ext.define('Rally.technicalservices.TimeModelBuilder',{
    singleton: true,

    build: function(modelType, newModelName) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: modelType,
            scope: this,
            success: function(model) {

                var day_fields = this._getDayFields();
                
                var additional_fields = Ext.Array.merge([], day_fields);

                var new_model = Ext.define(newModelName, {
                    extend: model,
                    fields: additional_fields
                });
                deferred.resolve(new_model);
            }
        });
        return deferred;
    },

    _getDayFields: function() {
        return Ext.Array.map(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], function(day) {
            return {
                name: Ext.String.format('__{0}', day),
                type: 'integer',
                defaultValue: null
            }
        });
    },
    
    // sometimes, dates are provided as beginning of day, but we 
    // want to go to the end of the day
    shiftToEndOfDay: function(js_date) {
        return Rally.util.DateTime.add(Rally.util.DateTime.add(js_date,'day',1),'second',-1);
    }
});