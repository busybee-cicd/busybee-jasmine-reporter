const rally = require('rally');
const queryUtils = rally.util.query;
const DEFAULT_FETCH = ['Name', 'ObjectID'];
const Logger = require('./Logger');
const logger = new Logger();

class BusybeeRally {

  constructor(conf) {
    this.api = rally(conf);
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
          logger.err(err.message);
          reject(err);
        });
    });
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
      logger.debug(`createObject ${type}, ${JSON.stringify(data)}, ${workspaceId}, ${projectId}`);
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

  createTestCaseResult(data) {
    logger.debug(`getTestCases ${JSON.stringify(data)}`);
    return this.createObject('testcaseresult', data)
  }

}

module.exports = BusybeeRally;
