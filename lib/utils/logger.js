import pino from 'pino';

/**
 * Create a logger instance with configuration
 * @param {Object} config - Logging configuration
 * @returns {Object} Pino logger instance
 */
export function createLogger(config) {
  const options = {
    level: config.level || 'info',
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        node_version: process.version
      })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err
    }
  };

  if (config.pretty) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    };
  }

  if (config.file) {
    options.transport = {
      targets: [
        ...(config.pretty ? [{
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          },
          level: config.level
        }] : []),
        {
          target: 'pino/file',
          options: { destination: config.file },
          level: config.level
        }
      ]
    };
  }

  return pino(options);
}

/**
 * Create a child logger with additional context
 * @param {Object} logger - Parent logger
 * @param {Object} context - Additional context
 * @returns {Object} Child logger
 */
export function createChildLogger(logger, context) {
  return logger.child(context);
}

/**
 * Log timing information for an operation
 * @param {Object} logger - Logger instance
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to time
 * @returns {Promise<*>} Result of the function
 */
export async function logTiming(logger, operation, fn) {
  const start = Date.now();
  logger.debug({ operation }, 'Starting operation');

  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.info({ operation, duration }, 'Operation completed');
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({ operation, duration, error }, 'Operation failed');
    throw error;
  }
}
