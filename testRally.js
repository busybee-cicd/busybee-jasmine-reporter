const BusybeeRally = require('./lib/BusybeeRally');
let conf = {
  workspace: 'Power & Water: PG PEIT',
  project: 'Configuration Reviewer',
  testFolder: 'UI Regression',
  apiKey: '_HLp8TV0cTQivY5NWjLjvQyr0QkM1xUcHgDeX4qYwR0',
  requestOptions: {
      headers: {
          'X-RallyIntegrationName': 'Busybee Integration Tests',
          'X-RallyIntegrationVendor': 'GE',
          'X-RallyIntegrationVersion': '1.0'
      }
  }
};

let rally = new BusybeeRally(conf);

rally.getTestCases(conf.workspace, conf.project, conf.testFolder)
     .then((results) => {
       console.log(JSON.stringify(results, null, '\t'));
     })
     .catch((err) => {
       console.log(err);
     });
