/* global Ext _ TSDateUtils Rally */
Ext.define('TSDateUtils', {
    singleton: true,
    
    startDayOfWeek: 'Sunday',
    
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
        
        return days.slice(startIndex).concat(days.slice(0,startIndex));
    }, function() {
        // memoization resolver to allow for unit tests to modify the startDayOfWeek
        return this.startDayOfWeek;
    }),
        
    /**
     * Given a start date, return an array of strings that represent the week(s) that contain
     * the start date.
     * 
     * If the configured 'startDayOfWeek' is 'Sunday', then this will return
     * and array containing one string, the Sunday immediately prior to the startDate.
     * 
     * Translate the requested startDate to the date of the immediately preceeding 'startDayOfWeek'.
     * 
     * If that day is a Sunday, we are done as that aligns with the native TimeEntryItem week start.
     * 
     * Otherwise, we must use two TimeEntryItems to hold the data. One for the Sunday week before
     * the 'startDayOfWeek', another for the Sunday week after the 'startDayOfWeek'.
     */
    getUtcSundayWeekStartStrings: function(localStartDate) {
        var dateOfWeekStart = this.getBeginningOfWeekForLocalDate(localStartDate);
        if ( dateOfWeekStart.getDay() === 0 ) {
            // Week starts on Sunday and fits into a native TimeEntryItem
            return [this.getUtcIsoForLocalDate(dateOfWeekStart, true)];
        } else {
            // Week starts on day other than Sunday. Two TimeEntryItems are needed to hold the data
            var priorSunday = Ext.Date.add(localStartDate, Ext.Date.DAY, -1 * dateOfWeekStart.getDay());
            var nextSunday = Ext.Date.add(localStartDate, Ext.Date.DAY, 7-dateOfWeekStart.getDay());
            return [
                this.getUtcIsoForLocalDate(priorSunday, true),
                this.getUtcIsoForLocalDate(nextSunday, true)
            ]
        }
    },
    
    getBeginningOfWeekForLocalDate: function(date) {
        var dayName = Ext.Date.format(date, 'l');
        var daysOfWeek = this.getDaysOfWeek();
        var offset = daysOfWeek.indexOf(dayName);

        var start_of_week_here = Ext.Date.add(date, Ext.Date.DAY, -1 * offset);
        return start_of_week_here;
    },
    
    getUtcIsoForLocalDate: function(date, showTimestamp) {
        // Add the timezone offset to get to UTC
        var utc = Ext.Date.add(date, Ext.Date.MINUTE, date.getTimezoneOffset());
        var utcString = Ext.Date.format(utc, 'Y-m-d');
        if ( showTimestamp ) {
            utcString += 'T00:00:00.000Z';
        }
        return utcString;
    },
    
    formatShiftedDate: function(jsdate,format) {
        var offset = jsdate.getTimezoneOffset();  // 480 is pacific, -330 is india

        if ( offset > 0 ) {
            jsdate = Rally.util.DateTime.add(jsdate,'minute',offset);
        }

        return Ext.util.Format.date(jsdate,format);
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
