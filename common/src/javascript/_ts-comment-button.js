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
                this._setResultCount();
                
                this.mon(this.el, this.clickEvent, this._showDialog, this);
                this.setDisabled(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading comments', msg);
            }
        });
    },
    
    _setResultCount: function() {
        var count = this.comments.length;
        var text = "";
        if ( count === 0 ) {
            text = Ext.String.format("<span class='icon-comment'>{0}</span>", "");
        } else {
            text = Ext.String.format("<span class='icon-comment'></span> {0}", count);
        }
        this.setText(text);
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
            preferences: this.comments,
            listeners: {
                scope: this,
                commentAdded: function(dialog,comment) {
                    console.log("added comment", comment);
                    this.comments = Ext.Array.merge(this.comments,comment);
                    this._setResultCount();
                },
                commentRemoved: function(dialog, comment) {
                    console.log("removed comment", comment);
                    this.comments = Ext.Array.remove(this.comments,comment);
                    this._setResultCount();
                }
            }
        });
    }
});