Ext.define('TSLockedWeek',{
    extend: 'Ext.data.Model',
    
    _timeLockKeyPrefix: 'rally.technicalservices.timesheet.weeklock',
    
    fields: [
        { name: '__Status', type: 'string', defaultValue: 'Unknown' }, // Open, Approved, Locked
        { name: 'WeekStartDate', type: 'date' },
        { name: '__LastUpdateBy', type: 'object' },
        { name: '__LastUpdateDate', type: 'date' },
        { name: 'Preference', type: 'object'}
    ],
    
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
        return Ext.String.format("{0}.{1}", 
            this._timeLockKeyPrefix,
            this.getWeekStart()
        );
    },
    
    lock: function() {
        var deferred = Ext.create('Deft.Deferred');
        
        var current_user = Rally.getApp().getContext().getUser();
        var status_owner = { _type: 'User', '_ref': current_user._ref, '_refObjectName': current_user._refObjectName }
        var status = "Locked";
        
        this.set('__Status', status);
        this.set('__LastUpdateBy', status_owner._refObjectName);
        
        var pref_key = this.getPreferenceKey();
        
        this._findOrCreatePreference(pref_key).then({
            scope: this,
            success: function(results) {
                if ( results.length > 0 ) {
                    var pref = results[0];
                    
                    var status_object = {
                        status: status,
                        status_date: new Date(),
                        status_owner: status_owner,
                        week_start: this.getWeekStart()
                    };
                    
                    pref.set('Value', Ext.JSON.encode(status_object));
                    pref.save({
                        callback: function(result, operation) {
                            if(!operation.wasSuccessful()) {
                                console.log(operation);
                                Ext.Msg.alert("Problem saving status");
                            } else {
                                deferred.resolve(result);
                            }
                        }
                    });
                }
            },
            failure: function(msg) {
                Ext.Msg.alert("Failed to save week lock state to " + pref_key, msg);
            }
        });
        return deferred.promise;
    },
    
    unlock: function() {
        var pref_key = this.getPreferenceKey();
        
        this._findOrCreatePreference(pref_key).then({
            scope: this,
            success: function(results) {
                if ( results.length > 0 ) {
                    results[0].destroy();
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
                var pref_config = {
                    Name: key,
                    Value: 'Open'
                };
                
                if ( Rally.getApp().isExternal() ) {
                    pref_config.Project = Rally.getApp().getContext().getProjectRef();
                } else {
                    pref_config.AppId = Rally.getApp().getAppId();
                }
                
                console.log("Saving new pref: ", pref_config);
                var pref = Ext.create(model, pref_config);
                
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