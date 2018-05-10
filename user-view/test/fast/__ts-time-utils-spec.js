describe("TSDateUtils", function() {
    describe("getDaysOfWeek", function() {
        
        describe('Sunday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Sunday';
            });
            
            it('returns days starting with Sunday', function() {
                var expectedDayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                var daysOfWeek = TSDateUtils.getDaysOfWeek();
                expect(_.difference(daysOfWeek, expectedDayOfWeek).length).toEqual(0);
            });
        });
        
        describe('Saturday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Saturday';
            });
            
            it('returns days starting with Saturday', function() {
                var expectedDayOfWeek = ['Saturday', 'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
                var daysOfWeek = TSDateUtils.getDaysOfWeek();
                expect(_.difference(daysOfWeek, expectedDayOfWeek).length).toEqual(0);
            });
        });
        
        describe('Monday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Monday';
            });
            
            it('returns days starting with Monday', function() {
                var expectedDayOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday', 'Saturday', 'Sunday'];
                var daysOfWeek = TSDateUtils.getDaysOfWeek();
                expect(_.difference(daysOfWeek, expectedDayOfWeek).length).toEqual(0);
            });
        });
    });
    
    describe('getUtcSundayWeekStartStrings', function() {
        var dateRange = _.range(6,13);
        
        describe('Sunday week start', function() {
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Sunday';
            });
            
            it('Every day of week returns 1 week start string', function() {
                _.each(dateRange, function(day) {
                    var startDate = new Date('5-' + day + '-2018');
                    var weekStartStrings = TSDateUtils.getUtcSundayWeekStartStrings(startDate);
                    expect(weekStartStrings.length).toEqual(1);
                });
            });
        });
        
        describe('Saturday week start', function() {
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Saturday';
            });
            
            it('Every day of week returns 2 week start strings', function() {
                _.each(dateRange, function(day) {
                    var startDate = new Date('5-' + day + '-2018');
                    var weekStartStrings = TSDateUtils.getUtcSundayWeekStartStrings(startDate);
                    expect(weekStartStrings.length).toEqual(2);
                });
            });
        });
        
        describe('Monday week start', function() {
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Monday';
            });
            
            it('Every day of week returns 2 week start strings', function() {
                _.each(dateRange, function(day) {
                    var startDate = new Date('5-' + day + '-2018');
                    var weekStartStrings = TSDateUtils.getUtcSundayWeekStartStrings(startDate);
                    expect(weekStartStrings.length).toEqual(2);
                });
            });
        });
    });
    
    describe('getBeginningOfWeekForLocalDate', function() {
        describe('Sunday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Sunday';
            });
            
            it('Saturday returns prior Sunday', function() {
                var date = new Date('5-5-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sun Apr 29 2018');
            });
            
            it('Sunday returns same Sunday', function() {
                var date = new Date('5-6-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sun May 06 2018');
            });
            
            it('Monday returns prior Sunday', function() {
                var date = new Date('5-7-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sun May 06 2018');
            });
        });
        
        describe('Saturday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Saturday';
            });
            
            it('Friday returns prior Saturday', function() {
                var date = new Date('5-4-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sat Apr 28 2018');
            });
        
            it('Saturday returns same Saturday', function() {
                var date = new Date('5-5-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sat May 05 2018');
            });
            
            it('Sunday returns prior Saturday', function() {
                var date = new Date('5-6-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Sat May 05 2018');
            });
        });
        
        describe('Monday week start', function() {
            var dayFields;
            
            beforeAll(function() {
                TSDateUtils.startDayOfWeek = 'Monday';
            });
            
            it('Sunday returns prior Monday', function() {
                var date = new Date('5-6-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Mon Apr 30 2018');
            });
            
            it('Monday returns same Monday', function() {
                var date = new Date('5-7-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Mon May 07 2018');
            });
            
            it('Tuesday returns prior Monday', function() {
                var date = new Date('5-8-2018');
                var result = TSDateUtils.getBeginningOfWeekForLocalDate(date);
                expect(result.toDateString()).toEqual('Mon May 07 2018');
            });
        });
    });
    
});
