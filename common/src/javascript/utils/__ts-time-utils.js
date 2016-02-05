Ext.define('TSDateUtils', {
    singleton: true,
    
    getBeginningOfWeekForLocalDate: function(week_date) {
        var start_of_week_here = Ext.Date.add(week_date, Ext.Date.DAY, -1 * week_date.getDay());
        return start_of_week_here;
    },
    
    getBeginningOfWeekISOForLocalDate: function(week_date,showShiftedTimeStamp) {
        var local_beginning = TSDateUtils.getBeginningOfWeekForLocalDate(week_date);
        
        if (showShiftedTimeStamp) {
            return Rally.util.DateTime.toIsoString(local_beginning).replace(/T.*$/,'T00:00:00.0Z');
        }
        
        return Rally.util.DateTime.toIsoString(local_beginning).replace(/T.*$/,'');
    }
});
