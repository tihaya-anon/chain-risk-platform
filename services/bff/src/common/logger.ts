import * as winston from "winston";

// Default config - will be updated when config is available
let logLevel = process.env.LOG_LEVEL || "info";
let logFormat = process.env.LOG_FORMAT || "console";

// Define log format
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} | ${level} | ${message}${metaStr}`;
  }),
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

// Create transports - stdout by default
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: logFormat === "json" ? jsonFormat : consoleFormat,
  }),
];

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  transports,
});

// Export a function to get child logger with context
export function getLogger(context: string): winston.Logger {
  return logger.child({ context });
}

// Function to update logger config after initialization
export function updateLoggerConfig(level: string, format: string): void {
  logLevel = level;
  logFormat = format;
  logger.level = level;
}
