const rally = require('rally');
const _ = require('lodash');
const queryUtils = rally.util.query;
const DEFAULT_FETCH = ['Name', 'ObjectID'];
const Logger = require('./Logger');
const logger = new Logger();
const _async = require('async');

class BusybeeRally {

  constructor(conf) {
    this.conf = conf;
    let rallyConf = conf.rally;
    if (!rallyConf.project) {
      throw new Error(`'rally.project' is a required field. skipping ${step} step.`);
    }

    this.api = rally(rallyConf);
  }

  /*
   Goal here is to return a query that should select 1 object by its name
  */
  buildQueryForObjByName(type, name, workspaceId, projectId, fetchOpts) {
    logger.debug(`buildQueryForObjByName ${type}, ${name}, ${workspaceId}, ${projectId}, ${JSON.stringify(fetchOpts)}`);
    let fetch = fetchOpts || DEFAULT_FETCH;
    let q = {
      type: type, //the type to query
      start: 1, //the 1-based start index, defaults to 1
      pageSize: 1, //the page size (1-200, defaults to 200)
      limit: 1, //the maximum number of results to return- enables auto paging
      fetch: fetch, //the fields to retrieve
      query: queryUtils.where('Name', '=', name), //optional filter
      requestOptions: {} //optional additional options to pass through to request
    };

    q = this.addScopeToQuery(q, workspaceId, projectId);

    return q;
  }

  addScopeToQuery(q, workspaceId, projectId) {
    logger.debug(`addScopeToQuery ${JSON.stringify(q)}, ${workspaceId}, ${projectId}`);
    if (workspaceId || projectId) {
      q.scope = {};
      if (workspaceId) { q.scope.workspace = `/workspace/${workspaceId}`; }
      if (projectId) { q.scope.project = `/project/${projectId}`; }
    }

    return q
  }

  getObjectByName(type, name, workspaceId, projectId, fetchOpts) {
    return new Promise((resolve, reject) => {
      logger.debug(`getObjectByName ${type}, ${name}, ${workspaceId}, ${projectId}, ${JSON.stringify(fetchOpts)}`);
      if (!name) { return resolve(); }

      let q = this.buildQueryForObjByName(type, name, workspaceId, projectId, fetchOpts);

      logger.debug(`q: ${JSON.stringify(q)}`);
      this.api.query(q)
        .then((res) => {
          logger.debug(`res: ${JSON.stringify(res)}`);
          let ret = null;
          if (res.Results[0]) {
            ret = res.Results[0].ObjectID;
          }

          resolve(ret);
        })
        .catch((err) => {
          logger.error(err.message);
          reject(err);
        });
    });
  }

  getUser(email) {
    return new Promise((resolve, reject) => {
      logger.debug(`getUser ${email}`);
      if (!email) { return resolve(); }

      let q = this.buildQueryForUser(email);

      logger.debug(`q: ${JSON.stringify(q)}`);
      this.api.query(q)
        .then((res) => {
          logger.debug(`res: ${JSON.stringify(res)}`);
          let ret = null;
          if (res.Results[0]) {
            ret = res.Results[0].ObjectID;
          }

          resolve(ret);
        })
        .catch((err) => {
          logger.err(err.message);
          reject(err);
        });
    });
  }

  buildQueryForUser(email) {
    logger.debug(`buildQueryForUser ${email}`);
    let q = {
      type: 'user', //the type to query
      start: 1, //the 1-based start index, defaults to 1
      pageSize: 1, //the page size (1-200, defaults to 200)
      limit: 1, //the maximum number of results to return- enables auto paging
      fetch: DEFAULT_FETCH, //the fields to retrieve
      query: queryUtils.where('EmailAddress', '=', email),
      requestOptions: {} //optional additional options to pass through to request
    };

    return q;
  }

  getOrCreateObjectByName(type, name, workspaceId, projectId, fetchOpts) {
    return new Promise((resolve, reject) => {
      logger.debug(`getOrCreateObjectByName ${type}, ${name}, ${workspaceId}, ${projectId}, ${JSON.stringify(fetchOpts)}`);
      this.getObjectByName(type, name, workspaceId, projectId, fetchOpts)
          .then((id) => {
            if (id) {
              resolve(id);
            } else {
              let data = {'Name': name};
              this.createObject(type, data, workspaceId, projectId)
                .then((folderId) => {
                  resolve(folderId)
                })
                .catch((err) => {
                  reject(err);
                });
            }
          })
          .catch((err) => {
            reject(err);
          });
    });
  }

  createObject(type, data, workspaceId, projectId) {
    return new Promise((resolve, reject) => {
      if (type == 'attachmentcontent') {
        logger.debug(`createObject ${type}, data, ${workspaceId}, ${projectId}`);
      } else {
        logger.debug(`createObject ${type}, ${JSON.stringify(data)}, ${workspaceId}, ${projectId}`);
      }

      let q = {
        type: type,
        data: data,
        fetch: DEFAULT_FETCH
      };

      q = this.addScopeToQuery(q, workspaceId, projectId);

      this.api.create(q)
        .then((res) => {
          let ret = null;
          logger.debug(res);
          // todo, select everything from fetch
          if (res.Object && res.Object.ObjectID) {
            ret = res.Object.ObjectID;
          }
          resolve(ret);
        })
        .catch((err) => {
          reject(err);
        })
    });
  }

  getTestCases(testFolderId) {
    return new Promise((resolve, reject) => {
      logger.debug(`getTestCases ${testFolderId}`);
      let q = {
          ref: `/testfolder/${testFolderId}/TestCases`,
          start: 1,
          pageSize: 200,
          limit: Infinity,
          fetch: DEFAULT_FETCH,
      };

      this.api.query(q)
        .then((res) => {
          resolve(res.Results)
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  publish(testSuiteResults) {
    return new Promise(async (resolve, reject) => {
      const rallyConf = this.conf.rally;
      /* A. first we need to figure out our applicable workspaceId, projectId and testFolderId */
      let workspaceId = await this.getObjectByName('workspace', rallyConf.workspace);
      logger.debug(`workspaceId ${workspaceId}`);
      let projectId = await this.getObjectByName('project', rallyConf.project, workspaceId);
      logger.debug(`projectId ${projectId}`);
      let testFolderId = await this.getOrCreateObjectByName('testfolder', rallyConf.testFolder, workspaceId, projectId);
      logger.debug(`testFolderId ${testFolderId}`);
      let userId = await this.getUser(rallyConf.user);
      logger.debug(`userId ${userId}`);

      // B. Now that we have our context ID's we can start to set up out TestCases.
      let knownRallyTestCases;

      try {
        knownRallyTestCases = await this.getTestCases(testFolderId);
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
              let testCaseId = await this.createObject('testCase', testCaseData);
              testCaseResultData['TestCase'] = `/testcase/${testCaseId}`;
              let testCaseResultId = await this.createObject('testcaseresult', testCaseResultData);
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
              let testCaseResultId = await this.createObject('testcaseresult', testCaseResultData);
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

          let attachmentContentId = await this.createObject('attachmentcontent', attachmentContent, workspaceId);
          let attachment = {
            Content: `/attachmentcontent/${attachmentContentId}`,
            ContentType: 'image/png',
            Description: spec.description,
            Name: `${spec.description.replace(/[^a-zA-Z ]/g, '').replace(/ /g, '+')}.png`,
            User: `/user/${userId}`,
            TestCaseResult: `/testcaseresult/${testCaseResultId}`
          }

          await this.createObject('attachment', attachment);
          cb();
        } catch (err) {
          cb(err);
        }
      })
    });

    _async.series(fns);
  }

}

module.exports = BusybeeRally;
