import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = path.join(__dirname, '../../logs');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          let log = `${timestamp} ${level}: ${message}`;

          if (context) {
            log += ` ${JSON.stringify(context)}`;
          }

          const metaKeys = Object.keys(meta);
          if (metaKeys.length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }

          return log;
        })
      )
    })
  ]
});

/**
 * Log a message with additional context
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {object} context - Additional context data
 */
export function logWithContext(level, message, context) {
  logger.log(level, message, { context });
}

export default logger;
