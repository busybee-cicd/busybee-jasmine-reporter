const BusybeeRally = require('./lib/BusybeeRally');
const _ = require('lodash');
const Logger = require('./lib/Logger');
const logger = new Logger();
const _async = require('async'); // remove once node 8 is the min req (async/await)

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

    let trimmedSpec = _.pick(result, ['description', 'failedExpectations', 'status']);

    // add any browser error logs
    browser.manage().logs().get('browser').then((browserLogs) => {
       if (browserLogs.length > 0) {
         trimmedSpec.browserLogs = browserLogs;
       }
       // mark the suite as containing failures
       if (trimmedSpec.failedExpectations && trimmedSpec.failedExpectations.length > 0) {
         this.testSuiteResults[this.currentSuite].hasFailures = true;
         browser.takeScreenshot().then((base64PNG) => {
           trimmedSpec.screenShot = base64PNG;
           this.testSuiteResults[this.currentSuite].specs.push(trimmedSpec);
         });
       } else {
         this.testSuiteResults[this.currentSuite].specs.push(trimmedSpec);
       }
    });

  }

  suiteDone(result) {
    console.log(`suiteDone: ${result.description}`);
    logger.debug(result);
    this.testSuiteResults[this.currentSuite].status = result.status;
    this.testSuiteResults[this.currentSuite].failedExpectations = result.failedExpectations;
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
      let userId;
      /* A. first we need to figure out our applicable workspaceId, projectId and testFolderId */
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
            return rally.getUser(config.user)
          })
          .then((id) => {
            logger.debug(`user id ${id}`)
            userId = id;
          })
          .then(() => {
            // B. Now that we have our context ID's we can start to set up out TestCases.
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
                    let notes = [];
                    let verdict = 'Pass';

                    if (suiteRes.hasFailures) {
                      verdict = 'Fail';
                    }

                    if (suiteRes.specs) {
                      notes = suiteRes.specs.map((spec) => { return Object.assign({}, _.pick(spec, ['description', 'status', 'browserLogs'])) ; });
                    }

                    let testCaseResultData = {
                      'Verdict': verdict,
                      'Notes': JSON.stringify(notes, null, '\t'),
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
                               rally.createObject('testcaseresult',testCaseResultData)
                                    .then((testCaseResultId) => {
                                      if (testCaseResultData.Verdict === 'Fail') {
                                        this.publishSpecFailureScreenshots(rally, suiteRes, testCaseResultId, workspaceId, userId)
                                            .then(() => {
                                              resolve();
                                            })
                                            .catch((err) => {
                                              reject(err);
                                            });
                                      } else {
                                        resolve();
                                      }
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
                        rally.createObject('testcaseresult', testCaseResultData)
                             .then((testCaseResultId) => {
                               if (testCaseResultData.Verdict === 'Fail') {
                                 this.publishSpecFailureScreenshots(rally, suiteRes, testCaseResultId, workspaceId, userId)
                                     .then(() => {
                                       resolve();
                                     })
                                     .catch((err) => {
                                       reject(err);
                                     });
                               } else {
                                 resolve();
                               }
                             })
                             .catch((err) => {
                               reject(err);
                             });
                      }));
                    }
                  });

                  Promise.all(promises)
                    .then(values => { resolve(values);
                    })
                    .catch(err => {
                      console.log("Errors encountered while pushing results to Rally")
                      reject(err);
                    })
                });
          })
          .catch((err) => {
            logger.error(`Error while fetching Rally content Ids`);
            logger.error(err.stack);
          }); // get testCases
    }); // outter promise

  }

  publishSpecFailureScreenshots(rally, suiteRes, testCaseResultId, workspaceId, userId) {
    let screenshotfns = [];
    suiteRes.specs.forEach((spec) => {
      screenshotfns.push((cb) => {
          if (!spec.screenShot) {
            return cb();
          }

          let attachmentContent = {
            Content: spec.screenShot
          }
          rally.createObject('attachmentcontent', attachmentContent, workspaceId)
               .then((attachmentContentId) => {
                 let attachment = {
                   Content: `/attachmentcontent/${attachmentContentId}`,
                   ContentType: 'image/png',
                   Description: spec.description,
                   Name: `${spec.description.replace(/[^a-zA-Z ]/g, '').replace(/ /g, '+')}.png`,
                   User: `/user/${userId}`,
                   TestCaseResult: `/testcaseresult/${testCaseResultId}`
                 }
                 rally.createObject('attachment', attachment)
                      .then(() => {
                        logger.debug(`attachment added to ${testCaseResultId}`);
                        cb();
                      })
                      .catch((err) => {
                        logger.error(`attachment failed to upload for ${testCaseResultId}`);
                        logger.error(err.stack);
                        cb(err);
                      })

               })
               .catch((err) => {
                 logger.error(`attachmentcontent failed to upload for ${testCaseResultId}`);
                 logger.error(err.stack);
                 cb(err);
               })
      });
    });

    return new Promise((resolve, reject) => {
      _async.series(screenshotfns, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      })
    })
  }

}


module.exports = BusybeeJasmineReporter;
