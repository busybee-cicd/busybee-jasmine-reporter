const _ = require('lodash');
const request = require('request');
const flowUrl = 'https://api.flowdock.com/messages';
const warningThreshold = .85;
const failureThreshold = .75;
const BusybeeRally = require('./BusybeeRally');
const Logger = require('./Logger');
const logger = new Logger();

/*
 flow_token: FLOWDOCK_PASSWORD,
 event: "activity",
 author: config.flowdockAuthor,
 title: "${stage}",
 body: "<a href='${BUILD_URL}'><b>${currentBuild.displayName.replaceAll("#", "")}</b> - ${message}</a>",
 external_thread_id: threadId.bytes.encodeBase64().toString(),
 thread: [
 title: title,
 status: [
 color: color,
 value: currentBuild.result ? currentBuild.result : "PENDING"
 ]
 ],
 link: env.BUILD_URL
 */
class BusybeeFlowdock {

  constructor(conf) {
    this.conf = conf;
  }

  publish(testSuiteResults) {
    return new Promise(async(resolve, reject) => {
      let flowConf = this.conf.flowdock;

      // build the result list (message body)
      let body = '';
      let count = 0;
      let pass = 0;
      _.forEach(testSuiteResults, (suiteRes, suiteName) => {
        count += 1;
        let verdict = suiteRes.hasFailures ? 'Fail' : 'Pass';
        if (verdict === 'Pass') {
          pass += 1;
          body += `${this.buildPassString(suiteName)}<br/>`;
        } else {
          body += `${this.buildFailString(suiteName)}<br/>`;
        }
      });

      // summarize the results and create the message title
      let statusValue = 'PASSED';
      let statusColor = 'green';
      let score = pass / count;
      if (score < warningThreshold) {
        if (score < failureThreshold) {
          statusValue = 'FAILING';
          statusColor = 'red';
        } else {
          statusValue = 'UNSTABLE';
          statusColor = 'yellow';
        }
      }

      let payload = {
        author: flowConf.author,
        flow_token: flowConf.token,
        event: 'activity',
        title: `${pass}/${count} Passing`,
        body: body,
        external_thread_id: flowConf.threadId,
        thread: {
          title: flowConf.threadTitle,
          status: {
            color: statusColor,
            value: statusValue
          }
        }
      }

      if (this.conf.rally) {
        try {
          let link = await this.getRallyLink();
          let linkedBody = `<a href='${link}'>${payload.body}</a>`;
          payload.body = linkedBody;
          this.send(payload);
          resolve();
        } catch (e) {
          reject(e);
        }
      } else {
        this.send(payload);
        resolve();
      }
    });
  }

  send(payload) {
    logger.debug('sending to flowdock');
    logger.debug(payload);
    request.post({url: flowUrl, body: payload, json: true});
  }

  getRallyLink() {
    return new Promise(async (resolve, reject) => {
      try {
        let rally = new BusybeeRally(this.conf);
        let workspaceId = await rally.getObjectByName('workspace', this.conf.rally.workspace);
        logger.debug(`workspaceId ${workspaceId}`);
        let projectId = await rally.getObjectByName('project', this.conf.rally.project, workspaceId);
        logger.debug(`projectId ${projectId}`);
        resolve(`https://rally1.rallydev.com/#/${projectId}/testfolders`)
      } catch (e) {
        return resolve('https://rally1.rallydev.com');
      }
    })
  }

  buildPassString(suiteName) {
    return this.buildVerdictString(suiteName, 'green');
  }

  buildFailString(suiteName) {
    return this.buildVerdictString(suiteName, 'red');
  }

  buildVerdictString(suiteName, color) {
    return `<span style='color:${color};'>${suiteName}<span>`;
  }

}

module.exports = BusybeeFlowdock;
