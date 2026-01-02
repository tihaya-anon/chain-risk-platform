import * as winston from "winston";
import { getConfig } from "../config/config";

const config = getConfig();

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

// Create transports based on config
const transports: winston.transport[] = [];

for (const outputPath of config.logging.outputPaths) {
  if (outputPath === "stdout") {
    transports.push(
      new winston.transports.Console({
        format: config.logging.format === "json" ? jsonFormat : consoleFormat,
      }),
    );
  } else if (outputPath === "stderr") {
    transports.push(
      new winston.transports.Console({
        stderrLevels: ["error", "warn", "info", "debug"],
        format: config.logging.format === "json" ? jsonFormat : consoleFormat,
      }),
    );
  } else {
    // File transport
    transports.push(
      new winston.transports.File({
        filename: outputPath,
        format: jsonFormat,
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 5,
      }),
    );
  }
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  transports,
});

// Export a function to get child logger with context
export function getLogger(context: string): winston.Logger {
  return logger.child({ context });
}
