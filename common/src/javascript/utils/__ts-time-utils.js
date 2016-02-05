Ext.define('TSDateUtils', {
    singleton: true,
    
    getBeginningOfWeekForLocalDate: function(week_date) {
        var start_of_week_here = Ext.Date.add(week_date, Ext.Date.DAY, -1 * week_date.getDay());
        return start_of_week_here;
    },
    
    getBeginningOfWeekISOForLocalDate: function(week_date,showShiftedTimeStamp) {
        var offset = week_date.getTimezoneOffset();  // 480 is pacific, -330 is india

        var local_beginning = TSDateUtils.getBeginningOfWeekForLocalDate(week_date);
        var shifted_time = Rally.util.DateTime.add(week_date,'minute',offset);
                
        if ( shifted_time.getDay() === 0 || shifted_time.getHours() === 0  ) {
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
    }
});
