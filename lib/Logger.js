const _ = require('lodash');
const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.logLevel = this.logLevel.toUpperCase();
    this.levelMap = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    }
  }

  static isLogLevel(val) {
    return validLevels.indexOf(val.toUpperCase()) !== -1 ? true : false;
  }

  passesLevel(level) {
    return this.levelMap[level] >= this.levelMap[this.logLevel];
  }

  debug(message, pretty) {
    this.write('DEBUG', message, pretty);
  }

  info(message, pretty) {
    this.write('INFO', message, pretty);
  }

  warn(message, pretty) {
    this.write('WARN', message, pretty);
  }

  error(message, pretty) {
    this.write('ERROR', message, pretty);
  }

  write(level, message, pretty) {
    if (!this.passesLevel(level)) { return; }

    if (_.isObject(message)) {
      if (pretty) {
        message = JSON.stringify(message, null, '\t');
      } else {
        message = JSON.stringify(message);
      }
      if (this.logLevel === 'DEBUG') {
        level = `${level}: `;
      }
      console.log(`BUSYBEE-JASMINE-REPORTER:${level}`);
      console.log(message);
    } else {
      console.log(`BUSYBEE-JASMINE-REPORTER:${level}: ${message}`);
    }

  }
}

module.exports = Logger;
