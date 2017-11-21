# busybee-jasmine-reporter
-------
A Jasmine reporter that will push test results to Rally and Flowdock.

## Quickstart

**v1.2.0 Requires NodeJS 8 or higher**

1.
protractor.conf.js
```
var BusybeeReporter = require ('busybee-jasmine-reporter');
var busybeeReporter = new BusybeeReporter({
    rally: {
      workspace: 'My Rally Workspace',
      project: 'My Rally Project',
      testFolder: 'UI Regression',
      apiKey: '<your_key>',
      requestOptions: {
          headers: {
              'X-RallyIntegrationName': 'My Integration Tests',
              'X-RallyIntegrationVendor': 'GE',
              'X-RallyIntegrationVersion': '1.0'
          }
      }
    },
    flowdock: {
        token: '<your_app_token>',
        author: {
          name: 'Sweeney Jenkins',
          avatar: 'https://github.build.ge.com/avatars/u/<your_image>',
          email: '<you_app_email>@ge.com'
        },
        threadId: 'it-results',
        threadTitle: 'Our App IT Results'
      }
});


// in order to have results posted to rally you MUST call publish in onComplete
onComplete: function() {
    return busybeeReporter.publish()
            .then(results => { console.log(JSON.stringify(results, null, '\t')); })
            .catch(err => { console.log(err.message); });
},
```

2. run your tests
3. go to Rally. Select the workspace specified in your config
4. navigate to Quality -> Test Plan
