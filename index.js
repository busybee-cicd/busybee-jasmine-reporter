const _ = require('lodash');
const BusybeeRally = require('./lib/BusybeeRally');
const BusybeeFlowdock = require('./lib/BusybeeFlowdock');
const Logger = require('./lib/Logger');
const logger = new Logger();

class BusybeeJasmineReporter {
  constructor(opts) {
    this.opts = opts;
    logger.debug(opts);
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
    this.testSuiteResults[result.description] = {description: result.description, specs: []};
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

  publish() {
    logger.debug(`publish`);
    return new Promise((resolve, reject) => {
      let promises = [];
      if (this.opts.rally) {
        promises.push(this.publishToRally());
      }
      if (this.opts.flowdock) {
        promises.push(this.publishToFlowdock());
      }

      Promise.all(promises)
        .then(result => {
          logger.debug(`publish resolve`);
          resolve(result);
        })
        .catch(err => {
          logger.debug(`publish reject`);
          reject(err);
        })
    });
  }

  publishToRally() {
    logger.debug(`publishToRally`);
    return new Promise(async (resolve, reject) => {
      logger.debug('Publish to Rally');

      try {
        let rally = new BusybeeRally(this.opts);
        let results = await rally.publish(this.testSuiteResults);
        resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  publishToFlowdock() {
    logger.debug(`publishToFlowdock`);
    const flowdock = new BusybeeFlowdock(this.opts);
    return flowdock.publish(this.testSuiteResults);
  }

}


module.exports = BusybeeJasmineReporter;
