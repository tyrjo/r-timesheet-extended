/* global Ext _ TSDateUtils Rally */
Ext.define('TSDateUtils', {
    singleton: true,
    
    startDayOfWeek: 'Wednesday',
    
    /**
     * Return the days of the week, starting from the configured start day (e.g. Sat.).
     * Memoize because we don't need to recompute more than once.
     */
    getDaysOfWeek: _.memoize(function() {
            var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            var startIndex = _.findIndex(days, function(day) {
                return day === this.startDayOfWeek;
            }, this);
        
            if ( startIndex === -1 ) {
                startIndex = 0;
            }
            this.startDayIndex = startIndex;
            
            return days.slice(startIndex).concat(days.slice(0,startIndex));
        }),
    
    getBeginningOfWeekForLocalDate: function(week_date) {
        this.getDaysOfWeek(); // Ensure this.startDayOffset is set
        var dayIndex = week_date.getDay();
        var offset;
        if ( dayIndex >= this.startDayIndex ) {
            offset = dayIndex - this.startDayIndex;
        } else {
            offset = dayIndex + this.startDayIndex + 1;
        }
        var start_of_week_here = Ext.Date.add(week_date, Ext.Date.DAY, -1 * offset);
        return start_of_week_here;
    },
    
    getBeginningOfWeekISOForLocalDate: function(week_date,showShiftedTimeStamp) {
        var offset = week_date.getTimezoneOffset();  // 480 is pacific, -330 is india
        
        var local_beginning = TSDateUtils.getBeginningOfWeekForLocalDate(week_date);
        var shifted_time = Rally.util.DateTime.add(week_date,'minute',offset);
                
        if ( shifted_time.getUTCDay() === 0 && shifted_time.getHours() === 0  ) {
            // this is already the beginning of the week
            var shifted_string = this.formatShiftedDate(week_date, 'Y-m-d');
            if ( showShiftedTimeStamp ) {
                return shifted_string + 'T00:00:00.0Z';
            }
            return shifted_string;
        }
        
        if (showShiftedTimeStamp) {
            return Rally.util.DateTime.toIsoString(local_beginning).replace(/T.*$/,'T00:00:00.0Z');
        }
        
        return Rally.util.DateTime.toIsoString(local_beginning).replace(/T.*$/,'');
    },
    
    formatShiftedDate: function(jsdate,format) {
        var offset = jsdate.getTimezoneOffset();  // 480 is pacific, -330 is india

        if ( offset > 0 ) {
            jsdate = Rally.util.DateTime.add(jsdate,'minute',offset);
        }

        return Ext.util.Format.date(jsdate,format);
    },
    
    pretendIMeantUTC: function(jsdate,asUTC) {
        var offset = jsdate.getTimezoneOffset();
        
        if ( asUTC ) {
            return Rally.util.DateTime.toIsoString(jsdate).replace(/T.*$/,'T00:00:00.000Z');
        }
        var shiftedDate = Rally.util.DateTime.add(jsdate,'minute',-1 * offset);
        
        return shiftedDate;
    },
    
    // returns a promise, fulfills with a boolean
    isApproved: function(week_start_iso, user_oid) {
        var deferred = Ext.create('Deft.Deferred');
        
        var short_iso_date = week_start_iso;
        var key_user_oid = user_oid || Rally.getApp().getContext().getUser().ObjectID;
        
        var key = Ext.String.format("{0}.{1}.{2}", 
            TSUtilities.approvalKeyPrefix,
            short_iso_date,
            key_user_oid
        );
        
        this._loadWeekStatusPreference(key).then({
            success: function(preference) {
                if (preference.length === 0) { 
                    deferred.resolve(false);
                    return;
                }
                var value = preference[0].get('Value');
                if ( /{/.test(value) ) {
                    var status_object = Ext.JSON.decode(value);
                    if ( status_object.status == TSTimesheet.STATUS.APPROVED ) { 
                        deferred.resolve(true);
                        return;
                    }
                }
                
                deferred.resolve(false);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _loadWeekStatusPreference: function(key) {
        
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
    }
});
