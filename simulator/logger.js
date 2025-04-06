const winston = require('winston');
const path = require('path');
const rfs = require('rotating-file-stream');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const levels = {
  alert: 0,
  error: 1,
  warn:  2,
  info:  3,
  http:  4,
  debug: 5,
};

const colors = {
  alert: 'red',
  error: 'magenta',
  warn:  'yellow',
  info:  'green',
  http:  'cyan',
  debug: 'blue',
};
winston.addColors(colors);

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

const errorLogStream = rfs.createStream('error.log', {
  interval: '1d',
  path: logDir,
  size: '10M',
  compress: 'gzip'
});

const combinedLogStream = rfs.createStream('combined.log', {
  interval: '1d',
  path: logDir,
  size: '10M',
  compress: 'gzip'
});

function createLogger(service) {
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} [${service}] ${info.level}: ${info.message}`,
    ),
  );

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.printf(
      (info) => `${info.timestamp} [${service}] ${info.level}: ${info.message}`,
    ),
  );

  return winston.createLogger({
    level: level(),
    levels,
    transports: [
      new winston.transports.Console({
        format: consoleFormat
      }),
      new winston.transports.Stream({
        stream: errorLogStream,
        level: 'error',
        format: fileFormat
      }),
      new winston.transports.Stream({
        stream: combinedLogStream,
        format: fileFormat
      }),
    ],
  });
}

module.exports = { createLogger };
