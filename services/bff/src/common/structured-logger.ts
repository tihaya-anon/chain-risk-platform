import { Injectable } from "@nestjs/common";
import { trace, SpanContext } from "@opentelemetry/api";

export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  trace_id?: string;
  span_id?: string;
  message: string;
  duration_ms?: number;
  error?: string;
  fields?: Record<string, unknown>;
}

/**
 * Structured JSON logger with OpenTelemetry trace correlation.
 */
@Injectable()
export class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string = "bff") {
    this.serviceName = serviceName;
  }

  private createEntry(
    level: string,
    message: string,
    fields?: Record<string, unknown>,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
    };

    // Extract trace context from current span
    const span = trace.getActiveSpan();
    if (span) {
      const ctx: SpanContext = span.spanContext();
      entry.trace_id = ctx.traceId;
      entry.span_id = ctx.spanId;
    }

    if (fields && Object.keys(fields).length > 0) {
      entry.fields = fields;
    }

    return entry;
  }

  private log(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log(this.createEntry("DEBUG", message, fields));
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.log(this.createEntry("INFO", message, fields));
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.log(this.createEntry("WARN", message, fields));
  }

  error(
    message: string,
    error?: Error,
    fields?: Record<string, unknown>,
  ): void {
    const entry = this.createEntry("ERROR", message, fields);
    if (error) {
      entry.error = error.stack || error.message;
    }
    this.log(entry);
  }

  withDuration(
    message: string,
    durationMs: number,
    fields?: Record<string, unknown>,
  ): void {
    const entry = this.createEntry("INFO", message, fields);
    entry.duration_ms = durationMs;
    this.log(entry);
  }

  /**
   * Create a child logger with additional default fields.
   */
  child(defaultFields: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, defaultFields);
  }
}

class ChildLogger {
  constructor(
    private parent: StructuredLogger,
    private defaultFields: Record<string, unknown>,
  ) {}

  private mergeFields(fields?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.defaultFields, ...fields };
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeFields(fields));
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeFields(fields));
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeFields(fields));
  }

  error(
    message: string,
    error?: Error,
    fields?: Record<string, unknown>,
  ): void {
    this.parent.error(message, error, this.mergeFields(fields));
  }
}

// Default logger instance
export const logger = new StructuredLogger("bff");

/**
 * Timing decorator for methods.
 */
export function Timed(operationName?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = Date.now();
      const name = operationName || propertyKey;

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        logger.withDuration(`${name} completed`, duration, { success: true });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(`${name} failed`, error as Error, { duration_ms: duration });
        throw error;
      }
    };

    return descriptor;
  };
}
