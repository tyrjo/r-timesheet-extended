Ext.define('TSTimesheet',{
    extend: 'Ext.data.Model',
    
    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',
    
    fields: [
        { name: '__UserName', type:'object' },
        { name: '__Hours',  type: 'float',  defaultValue: 0 },
        { name: '__Status', type: 'string', defaultValue: 'Unknown' }, // Open, Approved, Locked
        { name: 'User', type: 'object' },
        { name: 'WeekStartDate', type: 'date' },
        { name: '__LastUpdateBy', type: 'object' }
    ],
    
    isUpdatable: function() {
        return false;
    },
    
    isSelectable: function() {
        return true;
    },
    
    getWeekStart: function() {
        var start_date = this.get('WeekStartDate');
        start_date = Rally.util.DateTime.toIsoString(
            new Date(start_date.getUTCFullYear(), 
                start_date.getUTCMonth(), 
                start_date.getUTCDate(),  
                start_date.getUTCHours(), 
                start_date.getUTCMinutes(), 
                start_date.getUTCSeconds()
            )
        ).replace(/T.*$/,'');
        return start_date;
    },
    
    getPreferenceKey: function() {
        // get or create and then update pref
        return Ext.String.format("{0}.{1}.{2}", 
            this._approvalKeyPrefix,
            this.getWeekStart(),
            this.get('User').ObjectID
        );
    },
    
    approve: function() {
        var current_user = Rally.getApp().getContext().getUser();
        var status_owner = { _type: 'User', '_ref': current_user._ref, '_refObjectName': current_user._refObjectName }
        
        this.set('__Status', "Approved");
        this.set('__LastUpdateBy', status_owner._refObjectName);
        
        var pref_key = this.getPreferenceKey();
        
        this._findOrCreatePreference(pref_key).then({
            scope: this,
            success: function(results) {
                console.log('results:', results);
                if ( results.length > 0 ) {
                    var pref = results[0];
                    
                    var status_object = {
                        status: "Approved",
                        status_date: new Date(),
                        status_owner: status_owner
                    };
                    
                    pref.set('Value', Ext.JSON.encode(status_object));
                    pref.save({
                        callback: function(result, operation) {
                            if(!operation.wasSuccessful()) {
                                console.log(operation);
                                Ext.Msg.alert("Problem saving status");
                            }
                        }
                    });
                }
            },
            failure: function(msg) {
                Ext.Msg.alert("Failed to save approval state to " + pref_key, msg);
            }
        });
        
    },
    
    unlock: function() {
        this.set('__Status', "Open");
        
        var pref_key = this.getPreferenceKey();
        
        this._findOrCreatePreference(pref_key).then({
            scope: this,
            success: function(results) {
                console.log('results:', results);
                if ( results.length > 0 ) {
                    var pref = results[0];
                    var current_user = Rally.getApp().getContext().getUser();
                    
                    var status_object = {
                        status: "Open",
                        status_date: new Date(),
                        status_owner: { _type: 'User', '_ref': current_user._ref, '_refObjectName': current_user._refObjectName }
                    };
                    
                    pref.set('Value', Ext.JSON.encode(status_object));
                    pref.save({
                        callback: function(result, operation) {
                            if(!operation.wasSuccessful()) {
                                console.log(operation);
                                Ext.Msg.alert("Problem saving status");
                            }
                        }
                    });
                }
            },
            failure: function(msg) {
                Ext.Msg.alert("Failed to save approval state to " + pref_key, msg);
            }
        });
        
    },
    
    _findOrCreatePreference: function(key) {
        var deferred = Ext.create('Deft.Deferred');
        
        Deft.Chain.pipeline([
            function() { return this._findPreference(key); },
            function(pref) { return this._makePreference(key,pref); }
        ],this).then({
            scope: this,
            success: function(results) {
                deferred.resolve(results);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _findPreference: function(key) {
        var config = {
            model:'Preference',
            filters: [{property: 'Name', value: key}]
        };
        
        return TSUtilities._loadWsapiRecords(config);
    },
    
    /* leave prefs is null or empty array to create a pref because
     * this is pipelined from the search for a pref.  So we might have
     * gotten something and just want to pass it through
     */
    _makePreference: function(key,prefs) {
        var deferred = Ext.create('Deft.Deferred');
        if ( !Ext.isEmpty(prefs) && ( !Ext.isArray(prefs) || prefs.length > 0 )) {
            return prefs;
        }
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {
                var pref = Ext.create(model, {
                    Name: key,
                    Value: 'Open'
                });
                pref.save({
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            deferred.resolve([result]);
                        } else {
                            console.log(operation);
                            deferred.reject('oops');
                        }
                    }
                });
            }
        });
        return deferred.promise;
    }
    
});