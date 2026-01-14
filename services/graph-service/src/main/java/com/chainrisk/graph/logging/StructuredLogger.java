package com.chainrisk.graph.logging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Structured JSON logger with OpenTelemetry trace correlation.
 */
@Component
public class StructuredLogger {
    
    private static final Logger log = LoggerFactory.getLogger(StructuredLogger.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private final String serviceName;
    
    public StructuredLogger() {
        this.serviceName = "graph-service";
    }
    
    public void debug(String message, Map<String, Object> fields) {
        logStructured("DEBUG", message, fields, null);
    }
    
    public void info(String message, Map<String, Object> fields) {
        logStructured("INFO", message, fields, null);
    }
    
    public void warn(String message, Map<String, Object> fields) {
        logStructured("WARN", message, fields, null);
    }
    
    public void error(String message, Throwable error, Map<String, Object> fields) {
        logStructured("ERROR", message, fields, error);
    }
    
    public void withDuration(String message, long durationMs, Map<String, Object> fields) {
        Map<String, Object> entry = createEntry("INFO", message, fields, null);
        entry.put("duration_ms", durationMs);
        writeLog(entry);
    }
    
    private void logStructured(String level, String message, Map<String, Object> fields, Throwable error) {
        Map<String, Object> entry = createEntry(level, message, fields, error);
        writeLog(entry);
    }
    
    private Map<String, Object> createEntry(String level, String message, 
            Map<String, Object> fields, Throwable error) {
        Map<String, Object> entry = new HashMap<>();
        entry.put("timestamp", Instant.now().toString());
        entry.put("level", level);
        entry.put("service", serviceName);
        entry.put("message", message);
        
        // Add trace context
        Span currentSpan = Span.current();
        SpanContext spanContext = currentSpan.getSpanContext();
        if (spanContext.isValid()) {
            entry.put("trace_id", spanContext.getTraceId());
            entry.put("span_id", spanContext.getSpanId());
        }
        
        // Add custom fields
        if (fields != null && !fields.isEmpty()) {
            entry.put("fields", fields);
        }
        
        // Add error details
        if (error != null) {
            entry.put("error", formatError(error));
        }
        
        return entry;
    }
    
    private String formatError(Throwable error) {
        StringBuilder sb = new StringBuilder();
        sb.append(error.getClass().getName()).append(": ").append(error.getMessage());
        
        // Add first few stack frames
        StackTraceElement[] stack = error.getStackTrace();
        int framesToShow = Math.min(5, stack.length);
        for (int i = 0; i < framesToShow; i++) {
            sb.append("\n\tat ").append(stack[i]);
        }
        
        return sb.toString();
    }
    
    private void writeLog(Map<String, Object> entry) {
        try {
            String json = objectMapper.writeValueAsString(entry);
            // Use standard logger which will be captured by Promtail
            String level = (String) entry.get("level");
            switch (level) {
                case "DEBUG":
                    log.debug(json);
                    break;
                case "WARN":
                    log.warn(json);
                    break;
                case "ERROR":
                    log.error(json);
                    break;
                default:
                    log.info(json);
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize log entry", e);
        }
    }
    
    /**
     * Create a builder for fluent logging.
     */
    public LogBuilder builder(String message) {
        return new LogBuilder(this, message);
    }
    
    public static class LogBuilder {
        private final StructuredLogger logger;
        private final String message;
        private final Map<String, Object> fields = new HashMap<>();
        private Long durationMs;
        private Throwable error;
        
        LogBuilder(StructuredLogger logger, String message) {
            this.logger = logger;
            this.message = message;
        }
        
        public LogBuilder field(String key, Object value) {
            fields.put(key, value);
            return this;
        }
        
        public LogBuilder duration(long ms) {
            this.durationMs = ms;
            return this;
        }
        
        public LogBuilder error(Throwable e) {
            this.error = e;
            return this;
        }
        
        public void debug() {
            logger.debug(message, fields);
        }
        
        public void info() {
            if (durationMs != null) {
                logger.withDuration(message, durationMs, fields);
            } else {
                logger.info(message, fields);
            }
        }
        
        public void warn() {
            logger.warn(message, fields);
        }
        
        public void error() {
            logger.error(message, error, fields);
        }
    }
}
