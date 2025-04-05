import winston from 'winston';
import morgan from 'morgan';
import rfs from 'rotating-file-stream';
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

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
];

export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: path.join(__dirname, '..', '..', 'logs')
});

const authErrorLogStream = rfs.createStream('auth-error.log', {
  interval: '1d',
  path: path.join(__dirname, '..', '..', 'logs')
});

const morganMiddleware = morgan('combined', { stream: accessLogStream });

const morganAuthErrorMiddleware = morgan('combined', {
  stream: authErrorLogStream,
  skip: (req, res) => res.statusCode !== 401 && res.statusCode !== 403
});

const morganDevMiddleware = morgan('dev');

export const httpLogger = process.env.NODE_ENV === 'production'
  ? morganMiddleware
  : morganDevMiddleware;

export const authErrorLogger = process.env.NODE_ENV === 'production'
  ? morganAuthErrorMiddleware
  : null;

export default logger;