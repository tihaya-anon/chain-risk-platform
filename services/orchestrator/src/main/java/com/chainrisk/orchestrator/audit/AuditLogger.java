package com.chainrisk.orchestrator.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Structured audit logger for security events
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogger {

    private static final String SERVICE_NAME = "orchestrator";
    private final ObjectMapper objectMapper;

    /**
     * Event types for orchestrator
     */
    public enum EventType {
        AUTH_LOGIN,
        AUTH_LOGOUT,
        AUTH_FAILED,
        AUTH_TOKEN_REFRESH,
        API_REQUEST,
        RATE_LIMITED,
        CONFIG_CHANGE,
        ROUTING_ERROR
    }

    /**
     * Action types
     */
    public enum Action {
        READ, WRITE, DELETE, CREATE, UPDATE
    }

    /**
     * Status types
     */
    public enum Status {
        SUCCESS, FAILURE, DENIED
    }

    /**
     * Audit event structure
     */
    @Data
    @Builder
    public static class AuditEvent {
        private Instant timestamp;
        private EventType eventType;
        private String userId;
        private String ipAddress;
        private String resource;
        private Action action;
        private Status status;
        private Integer statusCode;
        private String serviceName;
        private String traceId;
        private Map<String, Object> metadata;
    }

    /**
     * Log an audit event
     */
    public void log(AuditEvent event) {
        if (event.getTimestamp() == null) {
            event.setTimestamp(Instant.now());
        }
        if (event.getServiceName() == null) {
            event.setServiceName(SERVICE_NAME);
        }

        // Set MDC for structured logging
        MDC.put("audit", "true");
        MDC.put("event_type", event.getEventType().name());
        MDC.put("user_id", event.getUserId() != null ? event.getUserId() : "anonymous");
        MDC.put("ip_address", event.getIpAddress() != null ? event.getIpAddress() : "unknown");
        MDC.put("resource", event.getResource());
        MDC.put("action", event.getAction().name());
        MDC.put("status", event.getStatus().name());
        MDC.put("service_name", SERVICE_NAME);

        if (event.getTraceId() != null) {
            MDC.put("trace_id", event.getTraceId());
        }

        try {
            String metadataJson = event.getMetadata() != null 
                ? objectMapper.writeValueAsString(event.getMetadata()) 
                : "{}";
            
            log.info("AUDIT event_type={} user_id={} ip_address={} resource={} action={} status={} metadata={}",
                    event.getEventType(),
                    event.getUserId(),
                    event.getIpAddress(),
                    event.getResource(),
                    event.getAction(),
                    event.getStatus(),
                    metadataJson);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit metadata", e);
            log.info("AUDIT event_type={} user_id={} ip_address={} resource={} action={} status={}",
                    event.getEventType(),
                    event.getUserId(),
                    event.getIpAddress(),
                    event.getResource(),
                    event.getAction(),
                    event.getStatus());
        } finally {
            MDC.clear();
        }
    }

    /**
     * Log successful login
     */
    public void logLogin(String userId, String ipAddress, String userAgent) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("user_agent", userAgent);
        
        log(AuditEvent.builder()
                .eventType(EventType.AUTH_LOGIN)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/auth/login")
                .action(Action.CREATE)
                .status(Status.SUCCESS)
                .statusCode(200)
                .metadata(metadata)
                .build());
    }

    /**
     * Log failed login attempt
     */
    public void logLoginFailed(String attemptedUser, String ipAddress, String reason) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("attempted_user", attemptedUser);
        metadata.put("failure_reason", reason);
        
        log(AuditEvent.builder()
                .eventType(EventType.AUTH_FAILED)
                .userId(attemptedUser)
                .ipAddress(ipAddress)
                .resource("/api/v1/auth/login")
                .action(Action.CREATE)
                .status(Status.FAILURE)
                .statusCode(401)
                .metadata(metadata)
                .build());
    }

    /**
     * Log logout
     */
    public void logLogout(String userId, String ipAddress) {
        log(AuditEvent.builder()
                .eventType(EventType.AUTH_LOGOUT)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/auth/logout")
                .action(Action.DELETE)
                .status(Status.SUCCESS)
                .statusCode(200)
                .build());
    }

    /**
     * Log token refresh
     */
    public void logTokenRefresh(String userId, String ipAddress, Status status) {
        log(AuditEvent.builder()
                .eventType(EventType.AUTH_TOKEN_REFRESH)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/auth/refresh")
                .action(Action.UPDATE)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 200 : 401)
                .build());
    }

    /**
     * Log rate limited request
     */
    public void logRateLimited(String userId, String ipAddress, String resource) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("reason", "rate_limit_exceeded");
        
        log(AuditEvent.builder()
                .eventType(EventType.RATE_LIMITED)
                .userId(userId != null ? userId : "anonymous")
                .ipAddress(ipAddress)
                .resource(resource)
                .action(Action.READ)
                .status(Status.DENIED)
                .statusCode(429)
                .metadata(metadata)
                .build());
    }

    /**
     * Log API request
     */
    public void logApiRequest(String userId, String ipAddress, String method, 
                              String path, int statusCode, long responseTimeMs) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("method", method);
        metadata.put("response_time_ms", responseTimeMs);
        
        Action action = switch (method) {
            case "POST" -> Action.CREATE;
            case "PUT", "PATCH" -> Action.UPDATE;
            case "DELETE" -> Action.DELETE;
            default -> Action.READ;
        };

        Status status = statusCode < 400 ? Status.SUCCESS : Status.FAILURE;
        
        log(AuditEvent.builder()
                .eventType(EventType.API_REQUEST)
                .userId(userId != null ? userId : "anonymous")
                .ipAddress(ipAddress)
                .resource(path)
                .action(action)
                .status(status)
                .statusCode(statusCode)
                .metadata(metadata)
                .build());
    }
}
