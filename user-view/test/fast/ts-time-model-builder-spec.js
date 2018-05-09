describe("Rally.technicalservices.TimeModelBuilder", function() {
    describe("_getTimeEntryForDayField", function() {
        var timeModelBuilder;
        
        beforeAll(function() {
            timeModelBuilder = Rally.technicalservices.TimeModelBuilder
            timeModelBuilder.get = jasmine.createSpy().and.returnValue(['1', '2']);
            spyOn(_, 'memoize').and.callFake(function(){
                console.log('FAKE');
            });
        });
        
        it("setup the singleton", function() {
            expect(timeModelBuilder).toBeDefined();  
        });
        
        describe('Sunday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Sunday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the first item for all days', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src ) {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('1');
                    }
                });
            });
        });
        
        describe('Saturday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Saturday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the first item for Saturday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src && dayField.name === '__Saturday') {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('1');
                    }
                });
            });
            
            it('returns the second item for all other days', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src  && dayField.name != '__Saturday') {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('2');
                    }
                });
            });
        });
        
        describe('Monday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Monday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the second item for Sunday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src && dayField.name === '__Sunday') {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('2');
                    }
                });
            });
            
            it('returns the first item for all other days', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src  && dayField.name != '__Sunday') {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('1');
                    }
                });
            });
        });
        
        describe('Wednesday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Wednesday';
                dayFields = timeModelBuilder._getDayFields();
            });
            
            it('returns the first item for Wednesday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src && dayField.name === '__Wednesday') {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('1');
                    }
                });
            });
            
            it('returns the second item for Tuesday', function() {
                _.each(dayFields, function(dayField) {
                    // Only test the __Monday, etc fields, not the __Monday_record fields
                    if ( dayField.__src  && dayField.name === '__Tuesday') {
                        expect(timeModelBuilder._getTimeEntryForDayField(dayField)).toEqual('2');
                    }
                });
            });
        });
    });
    
});
