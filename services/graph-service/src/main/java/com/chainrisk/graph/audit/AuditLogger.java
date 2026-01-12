package com.chainrisk.graph.audit;

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
 * Structured audit logger for graph service
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogger {

    private static final String SERVICE_NAME = "graph-service";
    private final ObjectMapper objectMapper;

    /**
     * Event types for graph service
     */
    public enum EventType {
        GRAPH_QUERY,
        PATH_FIND,
        NEIGHBOR_QUERY,
        CLUSTER_QUERY,
        TAG_ADD,
        TAG_REMOVE,
        TAG_PROPAGATE,
        CONFIG_CHANGE,
        API_REQUEST
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
     * Log graph query
     */
    public void logGraphQuery(String userId, String ipAddress, String address, 
                              int resultCount, long responseTimeMs, Status status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("address", address);
        metadata.put("result_count", resultCount);
        metadata.put("response_time_ms", responseTimeMs);
        
        log(AuditEvent.builder()
                .eventType(EventType.GRAPH_QUERY)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/graph/address/" + address)
                .action(Action.READ)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 200 : 500)
                .metadata(metadata)
                .build());
    }

    /**
     * Log path finding query
     */
    public void logPathFind(String userId, String ipAddress, String fromAddress, 
                           String toAddress, int pathLength, long responseTimeMs, Status status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("from_address", fromAddress);
        metadata.put("to_address", toAddress);
        metadata.put("path_length", pathLength);
        metadata.put("response_time_ms", responseTimeMs);
        
        log(AuditEvent.builder()
                .eventType(EventType.PATH_FIND)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/graph/path")
                .action(Action.READ)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 200 : 500)
                .metadata(metadata)
                .build());
    }

    /**
     * Log neighbor query
     */
    public void logNeighborQuery(String userId, String ipAddress, String address,
                                 int depth, int neighborCount, long responseTimeMs, Status status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("address", address);
        metadata.put("depth", depth);
        metadata.put("neighbor_count", neighborCount);
        metadata.put("response_time_ms", responseTimeMs);
        
        log(AuditEvent.builder()
                .eventType(EventType.NEIGHBOR_QUERY)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/graph/address/" + address + "/neighbors")
                .action(Action.READ)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 200 : 500)
                .metadata(metadata)
                .build());
    }

    /**
     * Log tag addition
     */
    public void logTagAdd(String userId, String ipAddress, String address, 
                          String tag, String source, Status status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("address", address);
        metadata.put("tag", tag);
        metadata.put("source", source);
        
        log(AuditEvent.builder()
                .eventType(EventType.TAG_ADD)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/graph/tags")
                .action(Action.CREATE)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 201 : 400)
                .metadata(metadata)
                .build());
    }

    /**
     * Log tag removal
     */
    public void logTagRemove(String userId, String ipAddress, String address, 
                             String tag, Status status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("address", address);
        metadata.put("tag", tag);
        
        log(AuditEvent.builder()
                .eventType(EventType.TAG_REMOVE)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/graph/tags/" + address)
                .action(Action.DELETE)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 204 : 404)
                .metadata(metadata)
                .build());
    }

    /**
     * Log cluster query
     */
    public void logClusterQuery(String userId, String ipAddress, String clusterId,
                                int memberCount, long responseTimeMs, Status status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("cluster_id", clusterId);
        metadata.put("member_count", memberCount);
        metadata.put("response_time_ms", responseTimeMs);
        
        log(AuditEvent.builder()
                .eventType(EventType.CLUSTER_QUERY)
                .userId(userId)
                .ipAddress(ipAddress)
                .resource("/api/v1/graph/clusters/" + clusterId)
                .action(Action.READ)
                .status(status)
                .statusCode(status == Status.SUCCESS ? 200 : 404)
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
