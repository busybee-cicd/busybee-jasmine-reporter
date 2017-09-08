#busybee-jasmine-reporter
-------
A basic jasmine reporter with support for posting results to Rally.

## Quickstart

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
    }
});


// in order to have results posted to rally you MUST call publishToRally in onComplete
onComplete: function() {
    return busybeeReporter.publishToRally()
            .then(results => { console.log(JSON.stringify(results, null, '\t')); })
            .catch(err => { console.log(err.message); });
},
```
