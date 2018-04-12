# Timesheet with Approval

A collection of timesheet management applications including:
* `admin-view` - description TBD
* `audit-view` - description TBD
* `common` - Utilities shared by two or more of the apps
* `finance-view` - description TBD
* `manager-view` - Managers can 'approve' or commend on user timesheets.
* `user-view` - Similar to the built-in timesheet application. Normal users enter time spent information for stories and tasks.

## Versions
* `1.x` branch- The original `r-timesheet-extended` set of applications. On April 12, 2018, this was moved into its own branch and tagged with `v1.0.0`
to allow access and updates to the original app if necessary.  Any customer using the original application should use this version
unless they would like to upgrade
* `master` branch - Refinements and new features to support new customer requirements.  This is the latest version, but may add (or remove)
features from the 1.x version.

## Setup
* Create a shared "preferences" project (e.g. `Shared Preferences (Used by 'Timesheet With Approval' app)`) where all timesheet users and managers have edit access.
This is used to store timesheet approval information.
* Pick (or create as the sub-admin) a User field that will hold the username of that user's manager.  (e.g. `Middle Name` is a good starting point for testing).
* Create a page for the `user-view` app.
   * Set the app setting `Preference Project` to be shared "preferences" project created above.
   * Share it with all projects that have users that will use it.
* Share the `manager-view` app with all projects
   * Set the app setting `Preference Project` to be shared "preferences" project created above.
   * Set the app setting `User Manager Field` to the User field picked above (e.g. `Middle Name` is good for testing)
   * Share it with all projects that have users that will use it.
* Update each User's `User Manager Field` (e.g. `Middle Name`) to contain the **username** of their manager.

## Use
* As a user, go to the `user-view` app. Select tasks and stories.  If needed, set "overhead" stories as defaults using the Gear icon. Enter time values.
* As a manager, go to the `manager-view` app. Review timesheets from users that have you as a manager. Approve, Unapprove, Comment on user timesheets.
Click on a user timesheet row to view the detailed timesheet.  You can the timesheet summary or detailed timesheet as a CSV file.

## Possible Enhancements
* Make manager field a comma separated list of user names
