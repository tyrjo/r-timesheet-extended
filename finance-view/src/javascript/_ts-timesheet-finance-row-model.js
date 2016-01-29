var TSTimesheetFinanceCalculators = {
    calculateWeekNumber: function(value, record) {
        console.log('calculateWeekNumber', value, record);
        var week_date = record.get('DateVal');
        if ( !Ext.isDate(week_date) ) {
            return -1;
        }
        return parseInt( Ext.Date.format(week_date, 'W', 10) );
    }
};

Ext.define('TSTimesheetFinanceRow',{
    extend: 'Ext.data.Model',
    
    fields: [
        { name: '__WorkItem', type:'object' },
        { name: '__WorkItemDisplay', type:'string' },
        { name: 'User', type: 'object' },
        { name: '__Location', type:'string' },
        { name: '__AssociateID', type:'string' },
        { name: '__EmployeeType', type:'string' },
        { name: '__CostCenter', type: 'string' },
        { name: '__Status', type: 'object' },
        { name: '__LastUpdateBy', type: 'object' },
        { name: '__LastUpdateDate', type: 'date' },
        { name: '__Task', type:'object' },
        { name: '__IsOpEx', type: 'boolean', defaultValue: false },
        { name: 'WeekStartDate', type: 'date' },
        { name: '__Product', type:'object' },
        { name: '__Release', type: 'object' },
        { name: 'DateVal', type: 'date' },
        { name: 'Hours', type: 'float' },
        
        /* calculated fields */
        { name: '___WeekNumber', type:'int', defaultValue: -1, convert:  TSTimesheetFinanceCalculators.calculateWeekNumber }
    ],
    
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
    }
    
});