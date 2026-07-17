import winston from 'winston';
import path from 'path';

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    log += `\n${stack}`;
  }

  return log;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'bean-brew-backend' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    // File transport for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || './logs', 'error.log'),
        level: 'error',
      }),
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || './logs', 'combined.log'),
      }),
    ] : []),
  ],
});

// Create stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};
