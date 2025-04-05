import winston from 'winston';
import morgan from 'morgan';
import { createStream } from 'rotating-file-stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  error: 'orange',
  warn:  'yellow',
  info:  'green',
  http:  'magenta',
  debug: 'blue',
};
winston.addColors(colors);

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'warn';
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const logger = winston.createLogger({
  level: level(),
  levels,
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat
    }),
    new winston.transports.File({ 
      filename: 'logs/all.log',
      format: fileFormat
    }),
  ],
});

const accessLogStream = createStream('access.log', {
  interval: '1d',
  path: path.join(__dirname, '..', '..', 'logs')
});

const authErrorLogStream = createStream('auth-error.log', {
  interval: '1d',
  path: path.join(__dirname, '..', '..', 'logs')
});

export const httpLogger = process.env.NODE_ENV === 'production'
  ? morgan('combined', { stream: accessLogStream })
  : morgan('dev');

export const authErrorLogger = process.env.NODE_ENV === 'production'
  ? morgan('combined', {
      stream: authErrorLogStream,
      skip: (req, res) => res.statusCode !== 401 && res.statusCode !== 403
    })
  : null;

export default logger;