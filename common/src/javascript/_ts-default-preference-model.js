Ext.define('TSDefaultPreference',{
    extend: 'Ext.data.Model',
        
    fields: [
        { name: '__Preference', type:'object' },
        { name: 'Name', type: 'string', convert: function(value,record) {
            if ( ! Ext.isEmpty(value) ) { return value; }
            
            if ( record && !Ext.isEmpty(record.get('__Preference'))) {
                return record.get('__Preference').get('Name');
            } else {
                return Ext.String.format("{0}.{1}", 
                    TSUtilities.pinKeyPrefix,
                    Rally.getApp().getContext().getUser().ObjectID
                );
            }
        }},
        { name: 'Value', type:'string', convert: function(value, record) {
            if ( ! Ext.isEmpty(value) ) { return value; }

            if ( record && !Ext.isEmpty(record.get('__Preference'))) {
                return record.get('__Preference').get('Value');
            }
            return null;
        }}
    ],
    
    addPin: function(record) {
        var task = record.get('Task');
        var workproduct = record.get('WorkProduct');
        
        var target_record_oid = workproduct.ObjectID;
        var type = workproduct._type;
        
        if ( !Ext.isEmpty(task) ) {
            target_record_oid = task.ObjectID;
            type = 'task';
        }
        
        var target_record_item = {
            type: type,
            ObjectID: target_record_oid
        };
        
        var pinned_items = Ext.Array.merge(this.getPinnedItems(), [target_record_item]);
        
        console.log(' pinned items: ', pinned_items, Ext.JSON.encode(pinned_items));
        
        this.set('Value', Ext.JSON.encode(pinned_items) );
        
        return this.save();
    },
    
    removePin: function(record) {
        var task = record.get('Task');
        var workproduct = record.get('WorkProduct');
        
        var target_record_oid = workproduct.ObjectID;
        var name = workproduct._refObjectName;
        
        if ( !Ext.isEmpty(task) ) {
            target_record_oid = task.ObjectID;
            name = task._refObjectName;
        }
       
        Rally.ui.notify.Notifier.show({message: 'Removed Default Item: ' + name});

        var pinned_items = Ext.Array.filter(this.getPinnedItems(), function(item) {
            var oid = item.ObjectID;
            return ( oid == target_record_oid );
        });
        
        this.set('Value', Ext.JSON.encode(pinned_items) );
        
        return this.save();
    },
    
    isPinned: function(record) {
        var task = record.get('Task');
        var workproduct = record.get('WorkProduct');
        
        var target_record_oid = workproduct.ObjectID;
        if ( !Ext.isEmpty(task) ) {
            target_record_oid = task.ObjectID;
        }
        
        return Ext.Array.contains(this.getPinnedOIDs(), target_record_oid);
    },
    
    getPinnedItems: function() {
        var value = this.get('Value');
        if ( Ext.isEmpty(value) ) {
            return [];
        }
        
        return Ext.JSON.decode(value);
    },
    
    getPinnedOIDs: function() {
        var item_array = this.getPinnedItems();
        return Ext.Array.map(item_array, function(item) { return item.ObjectID; });
    },
    
    save: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        var pref = this.get('__Preference'); 
        
        if ( Ext.isEmpty(pref)) {
            return this.createPreference(); 
        } else {
            pref.set('Value', me.get('Value'));
            
            pref.save({
                callback: function(result, operation) {
                    if(operation.wasSuccessful()) {
                        me.set('__Pref', result);
                        deferred.resolve(me);
                    } else {
                        deferred.reject(operation.error.errors[0]);
                    }
                }
            });
        }
        
        return deferred.promise;
    },
    
    createPreference: function() {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {
                var pref_config = {
                    Name:    me.get('Name'),
                    Value:   me.get('Value'),
                    Project: TSUtilities.getPreferenceProject()
                }

                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            me.set('__Pref', result);
                            deferred.resolve(me);
                        } else {
                            deferred.reject(operation.error.errors[0]);
                        }
                    }
                });
            }
        });
        
        return deferred.promise;
    }
});