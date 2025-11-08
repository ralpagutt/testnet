import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    }),

    // General log file
    new winston.transports.File({
      filename: path.join(logsDir, 'bot.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5
    }),

    // Relay-specific log file
    new winston.transports.File({
      filename: path.join(logsDir, 'relay.log'),
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// Export specialized loggers
export const relayLogger = logger.child({ component: 'relay' });
export const simLogger = logger.child({ component: 'simulator' });
export const priceLogger = logger.child({ component: 'price-monitor' });
export const executionLogger = logger.child({ component: 'execution' });

// Helper functions
export function logOpportunity(opportunity: any) {
  logger.info('💡 Opportunity detected', {
    buyPool: opportunity.buyPool,
    sellPool: opportunity.sellPool,
    spread: `${opportunity.spreadPercent.toFixed(2)}%`,
    estimatedProfit: opportunity.estimatedProfit
  });
}

export function logExecution(result: any) {
  if (result.success) {
    executionLogger.info('✅ Execution successful', {
      txHash: result.txHash,
      profit: result.profit,
      gasUsed: result.gasUsed
    });
  } else {
    executionLogger.error('❌ Execution failed', {
      error: result.error
    });
  }
}

export function logRelayAttempt(relayName: string, action: string, data?: any) {
  relayLogger.info(`[${relayName}] ${action}`, data);
}
