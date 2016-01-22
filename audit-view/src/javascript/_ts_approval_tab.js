Ext.define('Rally.technicalservices.ApprovalHistoryTab',{
    extend: 'Ext.panel.Panel',
    alias : 'widget.tsapprovalhistorytab',
    
    _approvalKeyPrefix: 'rally.technicalservices.timesheet.status',
    
    initComponent: function() {
        this.callParent();
        this.add(this._getGridConfig());
    },
    
    updateContent: function(app) {
        this.app = app;
        var me = this;
        
        Deft.Chain.sequence([
            this._loadPreferences,
            this._loadUsers
        ],this).then({
            success: function(results) {
                var preferences = results[0];
                var users = results[1];
                
                var users_by_oid = {};
                Ext.Array.each(users, function(user) {
                    users_by_oid[user.get('ObjectID')] = user;
                });
                
                var rows = Ext.Array.map(preferences, function(preference){
                    var value = preference.get('Value');
                    var status_object = Ext.JSON.decode(value);
                    var name_array = preference.get('Name').split('.');
                    
                    var week_start = name_array[4];
                    var user_oid = name_array[5];
                    
                    return {
                        WeekStartDate: week_start,
                        Status: status_object.status,
                        Changer: status_object.status_owner._refObjectName,
                        ChangeDate: preference.get('CreationDate'),
                        User: users_by_oid[user_oid] || "unavailable"
                    };
                });
                
                var calculated_store = Ext.create('Rally.data.custom.Store',{
                    pageSize: 1000,
                    data: rows
                });
                me.items.getAt(0).bindStore(calculated_store);
                me.app.setLoading(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading', msg);
            }
        });
    },
    
    _loadPreferences: function() {
        this.app.setLoading("Loading statuses...");

        var start_date = this.app.start_date;
        var end_date = this.app.end_date;
        
        var filters = [
            {property:'Name',operator:'contains',value:this._approvalKeyPrefix},
            {property:'CreationDate', operator: '>=', value: start_date },
            {property:'CreationDate', operator: '<=', value: end_date }
        ];
        var config = {
            model:'Preference',
            limit: 'Infinity',
            filters: filters,
            fetch: ['Name','Value','CreationDate'],
            sorters: [{property:'CreationDate',direction:'DESC'}]
        };

        return TSUtilities.loadWsapiRecords(config);
    },
    
    _loadUsers: function() {
        this.app.setLoading("Loading users...");

        var filters = [{property:'ObjectID',operator:'>',value:-1}];
        var config = {
            model:'User',
            limit: 'Infinity',
            filters: filters,
            fetch: ['UserName','DisplayName','ObjectID']
        };

        return TSUtilities.loadWsapiRecords(config);
    },
    
    _getGridConfig: function() {
        return {
            xtype                : 'rallygrid',
            sortableColumns      : false,
            showRowActionsColumn : false,
            showPagingToolbar    : false,
            columnCfgs           : this._getColumns(),
            store                : Ext.create('Rally.data.custom.Store', this._getStoreConfig())
        }
    },
    
    _getColumns: function() {
        var columns = [];
        
        columns.push({dataIndex:'User',text:'User', renderer: function(v) {
            if ( Ext.isString(v) ) { return v; }
            return v.get('DisplayName') || v.get('UserName');
        }});
        columns.push({dataIndex:'WeekStartDate',text:'Week Start'});
        columns.push({dataIndex:'Status',text:'Status'});
        columns.push({dataIndex:'Changer',text:'Changed By'});
        columns.push({dataIndex:'ChangeDate',text:'Change Date', flex: 1});
        
        return columns;
    },
    
    _getStoreConfig: function() {
        return {
            data: [{ 
                Status: '',
                Changer: '',
                ChangeDate: '',
                User: '',
                WeekStartDate: ''
            }]
        }
    }
});