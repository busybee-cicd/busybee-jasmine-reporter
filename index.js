const BusybeeRally = require('./lib/BusybeeRally');
const _ = require('lodash');

class BusybeeJasmineReporter {
  constructor(opts) {
    this.opts = opts;
    this.testSuiteResults = {};
    this.currentSuite;
  }

  jasmineStarted(suiteInfo) {
    console.log(`jasmineStarted`);
  }


  suiteStarted(result) {
  //     {
  // 	"id": "suite1",
  // 	"description": "link_approval_pg_plant_change-admin\n   User accesses the Approve/Reject page from the plant changes in the plant page header",
  // 	"fullName": "link_approval_pg_plant_change-admin\n   User accesses the Approve/Reject page from the plant changes in the plant page header",
  // 	"failedExpectations": []
  // }
    console.log(`suiteStarted: ${result.description}`);
    this.currentSuite = result.description;
    this.testSuiteResults[result.description] = { description: result.description, specs: [] };
    // if id.startsWith('suite') then its autogenerated and we can't rely on its uniqueness.
    // we will instead generate a suiteId from the description
  }

  specStarted(result) {
  // {
  // 	"id": "spec1",
  // 	"description": "\n   Given I am on the plant page",
  // 	"fullName": "link_approval_pg_plant_change-admin\n   User accesses the Approve/Reject page from the plant changes in the plant page header \n   Given I am on the plant page",
  // 	"failedExpectations": [], {matcherName, message, stack }
  // 	"passedExpectations": [],
  // 	"pendingReason": ""
  // }
    console.log(`specStarted: ${result.description}`);
    console.log(JSON.stringify(result, null, '\t'));
  }

  specDone(result) {
    // {
    // 	"id": "spec1",
    // 	"description": "\n   Given I am on the plant page",
    // 	"fullName": "link_approval_pg_plant_change-admin\n   User accesses the Approve/Reject page from the plant changes in the plant page header \n   Given I am on the plant page",
    // 	"failedExpectations": [], {matcherName, message, stack }
    // 	"passedExpectations": [
    // 		{
    // 			"matcherName": "toBe",
    // 			"message": "Passed.",
    // 			"stack": "",
    // 			"passed": true
    // 		}
    // 	],
    // 	"pendingReason": "",
    // 	"status": "passed"
    // }
    console.log(`specDone: ${result.description}`);
    console.log(JSON.stringify(result, null, '\t'));

    this.testSuiteResults[this.currentSuite]
      .specs.push(_.pick(result, ['description', 'failedExpectations', 'status']));
  }

  suiteDone(result) {
  // {
  // 	"id": "suite1",
  // 	"description": "link_approval_pg_plant_change-admin\n   User accesses the Approve/Reject page from the plant changes in the plant page header",
  // 	"fullName": "link_approval_pg_plant_change-admin\n   User accesses the Approve/Reject page from the plant changes in the plant page header",
  // 	"failedExpectations": [],
  // 	"status": "finished"
  // }
    console.log(`suiteDone: ${result.description}`);
    this.testSuiteResults[this.currentSuite].status = result.status;
    this.testSuiteResults[this.currentSuite].failedExpectations = result.failedExpectations;

    console.log(JSON.stringify(result, null, '\t'));
  }

  jasmineDone() {
    // write the json results
    console.log(`jasmineDone`);
    // all TestCases will be added to
    if (this.opts.rally) {
      this.publishToRally();
    }

    // pull down the existing testsets
  }

  publishToRally() {
    let step = 'Publish to Rally';
    const config = this.opts.rally;

    if (!config.project) {
      console.log(`'rally.project' is a required field. skipping ${step} step.`);
      return;
    }
    console.log(step);


    const rally = new BusybeeRally(config);

    let workspaceId;
    let projectId;

    rally.getObjectByName('workspace', config.workspace)
        .then((id) => {
          workspaceId = id;
          return this.getObjectByName('project', config.project, workspaceId);
        })
        .then((id) => {
          projectId = id;
          return this.getOrCreateObjectByName('testfolder', config.testFolder, workspaceId, projectId);
        })
        .then((id) => {
          testFolderId = id;
          console.log(`${workspaceId} | ${projectId} | ${testFolderId}`);
        })
        .then(() => {
          rally.getTestCases(testFolderId)
              .then((knownTestCases) => {
                console.log(JSON.stringify(knownTestCases, null, '\t'));
                // iterate each testSuiteResult and append an entry or add a new testSuite (testcase in rally) if not found
                _.forEach(this.testSuiteResults, (suiteRes, suiteId) => {
                  rally.getOrCreateTestCaseId(suiteId, workspaceId, projectId)
                       .then((testCaseId))
                });
              });
        })

  }

}


module.exports = BusybeeJasmineReporter;
