const rally = require('rally');
const queryUtils = rally.util.query;
const DEFAULT_FETCH = ['Name', 'ObjectID'];
class BusybeeRally {

  constructor(conf) {
    this.api = rally(conf);
  }

  /*
   Goal here is to return a query that should select 1 object by its name
  */
  buildQueryForObjByName(type, name, workspaceId, projectId, fetchOpts) {
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
    if (workspaceId || projectId) {
      q.scope = {};
      if (workspaceId) { q.scope.workspace = `/workspace/${workspaceId}`; }
      if (projectId) { q.scope.project = `/project/${projectId}`; }
    }

    return q
  }

  getObjectByName(type, name, workspaceId, projectId, fetchOpts) {
    return new Promise((resolve, reject) => {
      if (!name) { return resolve(); }

      let q = this.buildQueryForObjByName(type, name, workspaceId, projectId, fetchOpts);

      this.api.query(q)
        .then((res) => {
          let ret = null;
          if (res.Results[0]) {
            ret = res.Results[0].ObjectID;
          }
          resolve(ret);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  getOrCreateObjectByName(type, name, workspaceId, projectId, fetchOpts) {
    return new Promise((resolve, reject) => {
      this.getObjectByName(type, name, workspaceId, projectId, fetchOpts)
          .then((id) => {
            if (id) {
              return resolve(id);
            } else {
              this.createObjectWithName(type, name, workspaceId, projectId)
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

  createObjectWithName(type, name, workspaceId, projectId) {
    return new Promise((resolve, reject) => {
      let q = {
        type: type,
        data: {
            Name: name
        },
        fetch: DEFAULT_FETCH
      };

      q = this.addScopeToQuery(q, workspaceId, projectId);

      this.api.create(q)
        .then((res) => {
          let ret = null;
          if (res.Results[0]) {
            ret = res.Results[0].ObjectID;
          }
          resolve(ret);
        })
        .catch((err) => {
          reject(err);
        })
    });
  }

  createTestCase(name, workspaceId, projectId) {
    return new Promise((resolve, reject) => {
      this.createObjectWithName('testcase', name, workspaceId, projectId)
            .then((testCaseId) => {
              resolve(testCaseId);
            })
            .catch((err) => {
              reject(err);
            });
    });
  }

  getTestCases(testFolderId) {
    return new Promise((resolve, reject) => {
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

}

module.exports = BusybeeRally;
