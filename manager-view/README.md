# Manager View

Allows user `managers` and admins to view and approve timesheets created by the `User View` app.

## Available Settings
* Show All - show all user timesheets to admins, regardless of the user manager
* Allow Edit - allow managers to edit user timesheets
* Preference Project - the shared project used to save timesheet data. Must be available to all
timesheet users.
* User Manager Field - field on the User object to use as the `manager`. The field can be a comma
separated list of login names. These users will be considered the manager of a user and will be allowed
to view those user's timesheets.
* Extra Portfolio Item Fields - Select one additional field from the PortfolioItem associated with
each timesheet entry to include that field data in the CSV output.
* Week starts on - Select the day of week that the timesheet week will start (Sunday default)

## Development Notes

* Approval status (and who/when) is saved in a preference where the key is
the week start and the user OID and the number of millisconds since 1970. 
(rally.technicalservices.timesheet.status.2016-01-03.1127100000033.1453440772000)
* A preference is saved for each approval/unapproval so that we can audit approvals
and re-openings.

## Test Plan
* State Filter
   * RETEST - loads only timesheets in desired state
* Day picker
   * RETEST - all days in week reset picker to start of week
   * RETEST - default is prior month
* Row Actions
   * RETEST - Empty for not submitted sheets
   * RETEST - Approve submitted sheets
   * RETEST - Unapprove approved sheets
   * RETEST - Icon blank for not-submitted sheets
   * RETEST - Icon gear for not-submitted sheets
   * Multiple sheet actions
* RETEST - Extra PI field configurable
* RETEST - Manager Edit of timesheets is configurable
* NOT TESTED - Amending / Appending Items

### Timesheet popup
* RETEST - State Changes:
   * RETEST - Approve
   * RETEST - Unapprove
* Add Items
   * NOT TESTED
* Remove Items
   * NOT TESTED
* Test with renamed PortfolioItem (e.g. Feature renamed "Epic")
* RETEST - Column data
   * RETEST - Sort
   * RETEST - Feature shown for stories with feature
   * RETEST - Feature blank for stories without feature
   * RETEST - Feature shown for tasks on stories with feature
   * RETEST - Feature blank for tasks on stories without feature
   * RETEST - Work Product shown for all stories, defects and tasks
   * RETEST - Work Product Estimate shown for all items with estimate
   * RETEST - Work Product Schedule State
   * RETEST - Task shown for tasks
   * RETEST - Task Estimate
   * RETEST - Task State
   * RETEST - Release
   * RETEST - Iteration
* RETEST - Days columns
   * RETEST - Order matches configured start day of week
   * RETEST - Weekends colored blue
   * RETEST - Totals colored grey
   * NOT TESTED - 0-24 range, floating input only
   * NOT TESTED - Adjusting day adjusts day total
   * NOT TESTED - Adjusting day adjusts week total
   * RETEST - Total red if <40
 * NOT TESTED - Data saving
   * Entered data shown on browser refesh
   * Entered data shown on change to different week and back
* RETEST - Comments
   * RETEST - Read comments
   * RETEST - Add comments
* RETEST - Start day of week configurable
* RETEST - Non-Sunday Week Start
   * RETEST -  starts show appropriate start dates
   * RETEST - From/Through week pickers adjust to non-Sunday dates
   * RETEST - Hours column totals correct
   * RETEST - State changes work
   * RETEST - Comments work
* FAIL - Manager app has day totals and overall totals

### First Load

If you've just downloaded this from github and you want to do development, 
you're going to need to have these installed:

 * node.js
 * grunt-cli
 * grunt-init
 
Since you're getting this from github, we assume you have the command line
version of git also installed.  If not, go get git.

If you have those three installed, just type this in the root directory here
to get set up to develop:

  npm install

### Structure

  * src/javascript:  All the JS files saved here will be compiled into the 
  target html file
  * src/style: All of the stylesheets saved here will be compiled into the 
  target html file
  * test/fast: Fast jasmine tests go here.  There should also be a helper 
  file that is loaded first for creating mocks and doing other shortcuts
  (fastHelper.js) **Tests should be in a file named <something>-spec.js**
  * test/slow: Slow jasmine tests go here.  There should also be a helper
  file that is loaded first for creating mocks and doing other shortcuts 
  (slowHelper.js) **Tests should be in a file named <something>-spec.js**
  * templates: This is where templates that are used to create the production
  and debug html files live.  The advantage of using these templates is that
  you can configure the behavior of the html around the JS.
  * config.json: This file contains the configuration settings necessary to
  create the debug and production html files.  Server is only used for debug,
  name, className and sdk are used for both.
  * package.json: This file lists the dependencies for grunt
  * auth.json: This file should NOT be checked in.  Create this to run the
  slow test specs.  It should look like:
    {
        "username":"you@company.com",
        "password":"secret"
    }
  
### Usage of the grunt file
####Tasks
    
##### grunt debug

Use grunt debug to create the debug html file.  You only need to run this when you have added new files to
the src directories.

##### grunt build

Use grunt build to create the production html file.  We still have to copy the html file to a panel to test.

##### grunt test-fast

Use grunt test-fast to run the Jasmine tests in the fast directory.  Typically, the tests in the fast 
directory are more pure unit tests and do not need to connect to Rally.

##### grunt test-slow

Use grunt test-slow to run the Jasmine tests in the slow directory.  Typically, the tests in the slow
directory are more like integration tests in that they require connecting to Rally and interacting with
data.
