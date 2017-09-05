const BusybeeRally = require('./lib/BusybeeRally');
const _ = require('lodash');
const Logger = require('./lib/Logger');
const logger = new Logger();

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
    console.log(`suiteStarted: ${result.description}`);
    logger.debug(result);
    this.currentSuite = result.description;
    this.testSuiteResults[result.description] = { description: result.description, specs: [] };
  }

  specStarted(result) {
    console.log(`specStarted: ${result.description}`);
    logger.debug(result);
  }

  specDone(result) {
    logger.debug(result);

    this.testSuiteResults[this.currentSuite]
      .specs.push(_.pick(result, ['description', 'failedExpectations', 'status']));

    // mark the suite as containing failures
    if (result.failedExpectations && result.failedExpectations.length > 0) {
      this.testSuiteResults[this.currentSuite].hasFailures = true;
    }
  }

  suiteDone(result) {
    console.log(`suiteDone: ${result.description}`);
    this.testSuiteResults[this.currentSuite].status = result.status;
    this.testSuiteResults[this.currentSuite].failedExpectations = result.failedExpectations;
    logger.debug(result);
  }

  publishToRally(cb) {
    return new Promise((resolve, reject) => {
      let step = 'Publish to Rally';
      const config = this.opts.rally;

      if (!config.project) {
        logger.info(`'rally.project' is a required field. skipping ${step} step.`);
        return;
      }
      logger.debug(step);

      const rally = new BusybeeRally(config);

      let workspaceId;
      let projectId;
      let testFolderId;

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

                  logger.debug(knownRallyTestCases);
                  // 1. iterate each testSuiteResult
                  // 2. if notKnownToExist
                  //      create a promise to create the TestCase
                  //    end
                  // 3. add a TestCaseResult to the TestCase
                  let promises = [];
                  _.forEach(this.testSuiteResults, (suiteRes, suiteName) => {
                    let verdict = 'Pass';
                    if (suiteRes.hasFailures) {
                      verdict = 'Fail';
                    }
                    let testCaseResultData = {
                      'Verdict': verdict,
                      'Notes': JSON.stringify(suiteRes.specs, null, '\t'),
                      'Date': new Date().toISOString(),
                      'Build': new Date().toISOString()
                    };

                    if (!knownRallyCasesNameIdMap[suiteName]) {
                      logger.debug(`TestCase not in Rally: ${suiteName}`);
                      // if this isn't a known TestCase we need to create one
                      // in Rally first and return its id
                      let testCaseData = {
                        'Name': suiteName,
                        'Type': 'Regression',
                        'Method': 'Automated',
                        'TestFolder': `/testfolder/${testFolderId}`
                      };
                      promises.push(new Promise((resolve, reject) => {
                        rally.createObject('testCase', testCaseData)
                             .then((testCaseId) => {
                               testCaseResultData['TestCase'] = `/testcase/${testCaseId}`;
                               rally.createTestCaseResult(testCaseResultData, testCaseId)
                                    .then(() => {
                                      resolve();
                                    });
                             })
                             .catch((err) => {
                               reject(err);
                             });
                      }));
                    } else {
                      logger.debug(`TestCase found in Rally: ${suiteName}`);
                      promises.push(new Promise((resolve, reject) => {
                        // add a TestCaseResult for this existing TestCase
                        testCaseResultData['TestCase'] = knownRallyCasesNameIdMap[suiteName];
                        rally.createTestCaseResult(testCaseResultData)
                             .then(() => {
                               resolve();
                             })
                             .catch((err) => {
                               reject(err);
                             });
                      }));
                    }
                  });

                  Promise.all(promises)
                    .then(values => { resolve(values); })
                    .catch(err => { reject(err); })
                });
          }); // get testCases
    }); // outter promise

  }

}


module.exports = BusybeeJasmineReporter;
