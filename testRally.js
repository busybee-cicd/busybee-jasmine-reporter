const BusybeeRally = require('./lib/BusybeeRally');
const Logger = require('./lib/logger');
const logger = new Logger();
const config = {
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
const rally = new BusybeeRally(config);
let workspaceId;
let projectId;

rally.getObjectByName('workspace', config.workspace)
    .then((id) => {
      workspaceId = id;
      return rally.getObjectByName('project', config.project, workspaceId);
    })
    .then((id) => {
      logger.debug(`then ${id}`);
      projectId = id;
      return rally.getOrCreateObjectByName('testfolder', config.testFolder, workspaceId, projectId);
    })
    .then((id) => {
      testFolderId = id;
      logger.debug(`${workspaceId} | ${projectId} | ${testFolderId}`);
    })
    .then(() => {
      rally.getTestCases(testFolderId)
          .then((knownRallyTestCases) => {

            // create a map of name/id pairs to make lookup easier in the next step
            let knownRallyCasesNameIdMap = {};
            knownRallyTestCases.forEach((testCase) => {
              knownRallyCasesNameIdMap[testCase._refObjectName] = testCase.ObjectID;
            });

            logger.debug(knownTestCases);
            // 1. iterate each testSuiteResult
            // 2. if notKnownToExist
            //      create a promise to create the TestCase
            //    end
            // 3. add a TestCaseResult to the TestCase

            // _.forEach(this.testSuiteResults, (suiteRes, suiteName) => {
            //   let testCaseResultData = {
            //     'Verdict': suiteRes.failedExpectations.length > 0 ? 'Fail' : 'Pass',
            //     'Notes': JSON.stringify(suiteRes.specs, null, '\t'),
            //     'Date': Date.now()
            //   };
            //
            //   if (!knownRallyCasesNameIdMap[suiteName]) {
            //     logger.debug(`TestCase not in Rally: ${suiteName}`);
            //     // if this isn't a known TestCase we need to create one
            //     // in Rally first and return its id
            //     let testCaseData = {
            //       'Name': suiteName,
            //       'Type': 'Regression',
            //       'Method': 'Automated'
            //     };
            //     rally.createTestCase(testCaseData, workspaceId, projectId)
            //          .then((testCaseId) => {
            //            testCaseResultData['TestCase'] = `/testcase/${testCaseId}`;
            //            return rally.createTestCaseResult(testCaseResultData, testCaseId);
            //          })
            //          .catch((err) => {
            //            console.log(err.message);
            //          });
            //   } else {
            //     logger.debug(`TestCase found in Rally: ${suiteName}`);
            //     // add a TestCaseResult for this existing TestCase
            //     testCaseResultData['TestCase'] = knownRallyCasesNameIdMap[suiteName];
            //     rally.createTestCaseResult(testCaseResultData)
            //          .catch((err) => {
            //             console.log(err.message);
            //          });
            //   }
            //});
          });
    })
