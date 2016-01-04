Ext.define('Rally.technicalservices.CommentButton',{
    extend: 'Rally.ui.Button',
    requires: [
        'TSUtilities',
        'Rally.technicalservices.CommentDialog'
    ],
    
    alias: 'widget.tscommentbutton',
    
    config: {
        keyPrefix: null
    },
    
    constructor:function (config) {
        this.mergeConfig(config);
        if ( Ext.isEmpty(this.config.keyPrefix) ) {
            throw "keyPrefix is required for the Comment Button";
        }

        this.config.text = Ext.String.format("<span class='icon-comment'>{0}</span>", config.text || "");
        
        this.callParent([this.config]);
    },
    
    afterRender: function() {
        this.callParent(arguments);

        this.setDisabled(true);
        
        this._getComments().then({
            scope: this,
            success: function(results) {
                this.comments = results;
                this.mon(this.el, this.clickEvent, this._showDialog, this);
                this.setDisabled(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading comments', msg);
            }
        });
    },
    
    _getComments: function() {
        var deferred = Ext.create('Deft.Deferred');
        var key = this.keyPrefix;
        
        var config = {
            model:'Preference',
            filters: [{property:'Name',operator:'contains', value:key}],
            fetch: ['Name','Value','CreationDate']
        };
        
        TSUtilities._loadWsapiRecords(config).then({
            scope: this,
            success: function(results) {
                var text = "";
                if ( results.length === 0 ) {
                    text = Ext.String.format("<span class='icon-comment'>{0}</span>", "");
                } else {
                    text = Ext.String.format("<span class='icon-comment'></span> {0}", results.length);
                }
                                
                this.setText(text);
                deferred.resolve(results);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _showDialog: function() {
        console.log('show dialog', this.comments);
        Ext.create('Rally.technicalservices.CommentDialog',{
            autoShow: true,
            keyPrefix: this.keyPrefix,
            preferences: this.comments
        });
    }
});