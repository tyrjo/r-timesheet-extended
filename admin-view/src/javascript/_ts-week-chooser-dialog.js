/**
 * A dialog that displays artifacts to choose from
 *
 */
Ext.define('Rally.technicalservices.WeekChooserDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    alias:'widget.tsweekchooserdialog',

    width: 275,
    closable: true,
    
    config: {
        /**
         * @cfg {String}
         * Title to give to the dialog
         */
        title: 'Choose a Date',
        
        /**
         * @cfg {String}
         * Text to be displayed on the button when selection is complete
         */
        selectionButtonText: 'Done'

    },

    items: {
        xtype: 'panel',
        border: false,
        items: [
            {
                xtype: 'container',
                itemId: 'centerContainer'
            }
        ]
    },

    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
    },

    initComponent: function() {
        this.callParent(arguments);
        this.addEvents(
            /**
             * @event artifactChosen
             * Fires when user clicks done after choosing a date
             * @param {Rally.technicalservices.WeekChooserDialog} this dialog
             * @param {date} selected date
             */
            'weekChosen'
        );

        this.addCls('chooserDialog');

        this._buildButtons();
        this._buildPickers(this.down('#centerContainer'));
        
    },

    /**
     * @private
     */
    _buildButtons: function() {

        this.down('panel').addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    text: this.selectionButtonText,
                    cls: 'primary small',
                    scope: this,
                    handler: function() {
                        var selectedWeeks = this._getSelectedWeeks();
                        if (!this.multiple) {
                            selectedWeeks = selectedWeeks[0];
                        }
                        this.fireEvent('weekChosen', this, selectedWeeks);
                        this.close();
                    }
                },
                {
                    xtype: 'rallybutton',
                    text: 'Cancel',
                    cls: 'secondary small',
                    handler: this.close,
                    scope: this,
                    ui: 'link'
                }
            ]
        });

    },

    _getSelectedWeeks: function() {
        return [ this.down('#date_selector').getValue() ];
    },
    
    _buildPickers: function(container) {
        container.add({
            xtype:'rallydatefield',
            itemId:'date_selector',
            fieldLabel: 'Week Starting',
            listeners: {
                scope: this,
                change: function(dp, new_value) {
                    var week_start = this._getBeginningOfWeek(new_value);
                    if ( week_start !== new_value ) {
                        dp.setValue(week_start);
                    }
                }
            }
        }).setValue(new Date());
    },
    
    _getBeginningOfWeek: function(js_date){
        var start_of_week_here = Ext.Date.add(js_date, Ext.Date.DAY, -1 * js_date.getDay());
        return start_of_week_here;
    }
});
