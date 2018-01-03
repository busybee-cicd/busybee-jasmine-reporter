const BusybeeRally = require('busybee-rally');
const Logger = require('./Logger');
const logger = new Logger();
const _async = require('async');

class Rally {

  constructor(conf) {
    this.conf = conf;
    let rallyConf = conf.rally;
    if (!rallyConf.project) {
      throw new Error(`'rally.project' is a required field. skipping ${step} step.`);
    }

    this.busybeeRally = new BusybeeRally(rallyConf);
  }

  publish(testSuiteResults) {
    return new Promise(async (resolve, reject) => {
      const rallyConf = this.conf.rally;
      /* A. first we need to figure out our applicable workspaceId, projectId and testFolderId */
      let workspaceId = await this.busybeeRally.getObjectByName('workspace', rallyConf.workspace);
      logger.debug(`workspaceId ${workspaceId}`);
      let projectId = await this.busybeeRally.getObjectByName('project', rallyConf.project, workspaceId);
      logger.debug(`projectId ${projectId}`);
      let testFolderId = await this.busybeeRally.getOrCreateObjectByName('testfolder', rallyConf.testFolder, workspaceId, projectId);
      logger.debug(`testFolderId ${testFolderId}`);
      let userId = await this.busybeeRally.getUser(rallyConf.user);
      logger.debug(`userId ${userId}`);

      // B. Now that we have our context ID's we can start to set up out TestCases.
      let knownRallyTestCases;

      try {
        knownRallyTestCases = await this.busybeeRally.getTestCases(testFolderId);
      } catch (e) {
        return reject(e);
      }

      // create a map of name/id pairs to make lookup easier in the next step
      let knownRallyCasesNameIdMap = {};
      logger.debug(`${knownRallyTestCases.length} knownRallyTestCases`);
      knownRallyTestCases.forEach((testCase) => {
        knownRallyCasesNameIdMap[testCase._refObjectName] = testCase.ObjectID;
      });

      //logger.debug(knownRallyTestCases);
      // 1. iterate each testSuiteResult
      // 2. if notKnownToExist
      //      create a promise to create the TestCase
      //    end
      // 3. add a TestCaseResult to the TestCase
      let promises = [];
      logger.debug(testSuiteResults);
      _.forEach(testSuiteResults, (suiteRes, suiteName) => {
        logger.debug(`Processing testSuiteResult: ${suiteName}`);
        let notes = [];
        let verdict = suiteRes.hasFailures ? 'Fail' : 'Pass';

        if (suiteRes.specs) {
          logger.debug(`${suiteName} has ${suiteRes.specs.length} specs`);
          notes = suiteRes.specs.map((spec) => {
            return Object.assign({}, _.pick(spec, ['description', 'status', 'browserLogs']));
          });
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
          promises.push(new Promise( async(resolve, reject) => {
            try {
              let testCaseId = await this.busybeeRally.createObject('testCase', testCaseData);
              testCaseResultData['TestCase'] = `/testcase/${testCaseId}`;
              let testCaseResultId = await this.busybeeRally.createObject('testcaseresult', testCaseResultData);
              if (testCaseResultData.Verdict === 'Fail') {
                await this.publishSpecFailureScreenshots(suiteRes, testCaseResultId, workspaceId, userId);
                resolve();
              }
            } catch (err) {
              reject(err);
            }
          }));
        } else {
          logger.debug(`TestCase found in Rally: ${suiteName}`);
          promises.push(new Promise(async(resolve, reject) => {
            // add a TestCaseResult for this existing TestCase
            testCaseResultData['TestCase'] = knownRallyCasesNameIdMap[suiteName];
            try {
              let testCaseResultId = await this.busybeeRally.createObject('testcaseresult', testCaseResultData);
              if (testCaseResultData.Verdict === 'Fail') {
                await this.publishSpecFailureScreenshots(suiteRes, testCaseResultId, workspaceId, userId);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          }));
        }
      });

      Promise.all(promises)
        .then(values => {
          resolve(values);
        })
        .catch(err => {
          console.log("Errors encountered while pushing results to Rally")
          reject(err);
        });
    });
  }

  publishSpecFailureScreenshots(suiteRes, testCaseResultId, workspaceId, userId) {
    let fns = [];

    suiteRes.specs.forEach((spec) => {
      if (!spec.screenShot) {
        return;
      }

      fns.push(async (cb) => {
        try {
          let attachmentContent = {
            Content: spec.screenShot
          };

          let attachmentContentId = await this.busybeeRally.createObject('attachmentcontent', attachmentContent, workspaceId);
          let attachment = {
            Content: `/attachmentcontent/${attachmentContentId}`,
            ContentType: 'image/png',
            Description: spec.description,
            Name: `${spec.description.replace(/[^a-zA-Z ]/g, '').replace(/ /g, '+')}.png`,
            User: `/user/${userId}`,
            TestCaseResult: `/testcaseresult/${testCaseResultId}`
          }

          await this.busybeeRally.createObject('attachment', attachment);
          cb();
        } catch (err) {
          cb(err);
        }
      })
    });

    _async.series(fns);
  }

}

module.exports = Rally;
