import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/index.js';
import { existsSync, mkdirSync } from 'fs';

// Ensure log directory exists
if (!existsSync(config.logging.dir)) {
  mkdirSync(config.logging.dir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transport for general logs
const generalTransport = new DailyRotateFile({
  filename: `${config.logging.dir}/app-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
  level: config.logging.level
});

// Transport for error logs
const errorTransport = new DailyRotateFile({
  filename: `${config.logging.dir}/error-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
  level: 'error'
});

// Transport for stratum-specific logs
const stratumTransport = new DailyRotateFile({
  filename: `${config.logging.dir}/stratum-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '7d',
  format: fileFormat,
  level: 'debug'
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: fileFormat,
  defaultMeta: { service: 'nomp-v2' },
  transports: [
    generalTransport,
    errorTransport
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: `${config.logging.dir}/exceptions-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: `${config.logging.dir}/rejections-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Add console transport in development
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create specialized loggers
export const stratumLogger = winston.createLogger({
  level: 'debug',
  format: fileFormat,
  defaultMeta: { service: 'stratum' },
  transports: [stratumTransport]
});

export const apiLogger = winston.createLogger({
  level: config.logging.level,
  format: fileFormat,
  defaultMeta: { service: 'api' },
  transports: [
    new DailyRotateFile({
      filename: `${config.logging.dir}/api-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: fileFormat
    })
  ]
});

// Helper methods
logger.system = (component, message, meta = {}) => {
  logger.info(message, { component, ...meta });
};

logger.pool = (poolName, message, meta = {}) => {
  logger.info(message, { pool: poolName, ...meta });
};

logger.worker = (workerId, message, meta = {}) => {
  logger.debug(message, { worker: workerId, ...meta });
};

logger.stratum = (message, meta = {}) => {
  stratumLogger.info(message, meta);
};

logger.api = (message, meta = {}) => {
  apiLogger.info(message, meta);
};

export default logger;
