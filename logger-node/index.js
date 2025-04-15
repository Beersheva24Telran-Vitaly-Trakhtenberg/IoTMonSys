import winston from 'winston';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import * as rfs from 'rotating-file-stream';

console.log('--- LOGGER-NODE MODULE LOADED ---');

const levels = {
  alert: 0,
  error: 1,
  warn: 2,
  info: 3,
  http: 4,
  debug: 5,
};

const colors = {
  alert: 'red',
  error: 'magenta',
  warn: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'blue',
};
winston.addColors(colors);

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

/**
 * @param {string} service
 * @param {string|null} customLogDir
 * @returns {winston.Logger}
 */
function createLoggerFunction(service, customLogDir = null) {
  if (!service) {
    service = 'default';
    console.warn('Logger service name not provided, using "default".');
  }

  let logDir;
  if (customLogDir) {
    logDir = path.resolve(customLogDir, service);
  } else {
    logDir = path.resolve(process.cwd(), 'logs', service);
  }

  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (err) {
      console.error(`Failed to create log directory ${logDir}:`, err);
    }
  }

  const createRfsStream = (filename) => {
    try {
      return rfs.createStream(filename, {
        interval: '1d',
        path: logDir,
        size: '10M',
        compress: 'gzip',
      });
    } catch (err) {
      console.error(`Failed to create rotating file stream for ${filename} in ${logDir}:`, err);
      return null;
    }
  };

  const errorLogStream = createRfsStream('error.log');
  const combinedLogStream = createRfsStream('combined.log');

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} [${service}] ${info.level}: ${info.message}`
    )
  );

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.printf(
      (info) => `${info.timestamp} [${service}] ${info.level}: ${info.message}`
    )
  );

  const transports = [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ];

  if (errorLogStream) {
    transports.push(
      new winston.transports.Stream({
        stream: errorLogStream,
        level: 'error',
        format: fileFormat,
      })
    );
  }
  if (combinedLogStream) {
    transports.push(
      new winston.transports.Stream({
        stream: combinedLogStream,
        format: fileFormat,
      })
    );
  }

  return winston.createLogger({
    level: level(),
    levels,
    format: winston.format.errors({ stack: true }),
    transports,
    exitOnError: false,
  });
}

/**
 * Creates middleware for logging HTTP requests.
 * Using Morgan for logging HTTP-requests, sends output to the provided Winston-logger.
 * @param {winston.Logger} loggerInstance - Instance of Winston logger, built by createLogger.
 * @param {object} [options={}] - Options.
 * @param {'combined' | 'common' | 'dev' | 'short' | 'tiny' | string} [options.format] - Logs Morgan format. By default: 'dev' for development, 'combined' for production.
 * @param {boolean} [options.logOnlyAuthErrors=false] - When flag is true, logs just answers with status code 401/403 (only in production).
 * @returns {Function} - Morgan middleware.
 */
function createHttpLoggerMiddleware(loggerInstance, options = {}) {
  const env = process.env.NODE_ENV || 'development';
  const defaultFormat = env === 'development' ? 'dev' : 'combined';
  const format = options.format || defaultFormat;
  const logOnlyAuthErrors = options.logOnlyAuthErrors || false;

  const morganOptions = {
    stream: {
      write: (message) => {
        const level = logOnlyAuthErrors ? 'warn' : 'http';
        loggerInstance[level](message.trim());
      },
    },
  };

  if (logOnlyAuthErrors && env === 'production') {
    morganOptions.skip = (req, res) => res.statusCode !== 401 && res.statusCode !== 403;
  } else if (logOnlyAuthErrors && env !== 'production') {
    return (req, res, next) => next();
  }

  return morgan(format, morganOptions);
}

const loggerLibrary = {
  createLogger: createLoggerFunction,
  createHttpLoggerMiddleware: createHttpLoggerMiddleware,
};

export const createHttpLogger = loggerLibrary.createHttpLoggerMiddleware;
export const createLogger = loggerLibrary.createLogger;
export default loggerLibrary;