import winston from 'winston';
import morgan from 'morgan';
import { createStream } from 'rotating-file-stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loggerLevels = {
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

const loggerLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
  ),
);

  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),

});
