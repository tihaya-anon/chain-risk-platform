package com.chainrisk.orchestrator.admin;

import com.chainrisk.orchestrator.config.PipelineProperties;
import com.chainrisk.orchestrator.config.RiskProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Admin Controller for pipeline management and monitoring.
 * Provides endpoints to view configuration, service status, and control pipeline components.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin API", description = "Pipeline administration and monitoring")
public class AdminController {

    private final PipelineProperties pipelineProperties;
    private final RiskProperties riskProperties;
    private final DiscoveryClient discoveryClient;
    private final WebClient.Builder webClientBuilder;

    // ==================== Configuration Endpoints ====================

    @GetMapping("/config/pipeline")
    @Operation(summary = "Get pipeline configuration", description = "Returns current pipeline configuration from Nacos")
    public ResponseEntity<PipelineProperties> getPipelineConfig() {
        return ResponseEntity.ok(pipelineProperties);
    }

    @GetMapping("/config/risk")
    @Operation(summary = "Get risk configuration", description = "Returns current risk scoring configuration from Nacos")
    public ResponseEntity<RiskProperties> getRiskConfig() {
        return ResponseEntity.ok(riskProperties);
    }

    @GetMapping("/config/all")
    @Operation(summary = "Get all configurations", description = "Returns all configurations from Nacos")
    public ResponseEntity<Map<String, Object>> getAllConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("pipeline", pipelineProperties);
        config.put("risk", riskProperties);
        return ResponseEntity.ok(config);
    }

    // ==================== Service Discovery Endpoints ====================

    @GetMapping("/services")
    @Operation(summary = "List all registered services", description = "Returns all services registered in Nacos")
    public ResponseEntity<Map<String, Object>> getServices() {
        List<String> services = discoveryClient.getServices();
        Map<String, Object> result = new HashMap<>();
        result.put("services", services);
        result.put("count", services.size());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/services/{serviceName}")
    @Operation(summary = "Get service instances", description = "Returns all instances of a specific service")
    public ResponseEntity<Map<String, Object>> getServiceInstances(@PathVariable String serviceName) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        
        List<Map<String, Object>> instanceList = instances.stream()
            .map(instance -> {
                Map<String, Object> info = new HashMap<>();
                info.put("instanceId", instance.getInstanceId());
                info.put("host", instance.getHost());
                info.put("port", instance.getPort());
                info.put("uri", instance.getUri().toString());
                info.put("metadata", instance.getMetadata());
                info.put("secure", instance.isSecure());
                return info;
            })
            .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("serviceName", serviceName);
        result.put("instances", instanceList);
        result.put("count", instanceList.size());
        return ResponseEntity.ok(result);
    }

    // ==================== Pipeline Status Endpoints ====================

    @GetMapping("/pipeline/status")
    @Operation(summary = "Get pipeline status", description = "Returns aggregated status of all pipeline components")
    public Mono<Map<String, Object>> getPipelineStatus() {
        // Get status from each service
        Mono<Map> ingestionStatus = getServiceStatus("data-ingestion", "/admin/status");
        Mono<Map> graphStatus = getServiceStatus("graph-engine", "/admin/status");
        
        return Mono.zip(ingestionStatus, graphStatus)
            .map(tuple -> {
                Map<String, Object> status = new HashMap<>();
                status.put("config", Map.of(
                    "pipelineEnabled", pipelineProperties.isEnabled(),
                    "ingestionEnabled", pipelineProperties.getIngestion().isEnabled(),
                    "graphSyncEnabled", pipelineProperties.getGraphSync().isEnabled()
                ));
                status.put("services", Map.of(
                    "ingestion", tuple.getT1(),
                    "graphEngine", tuple.getT2()
                ));
                status.put("timestamp", System.currentTimeMillis());
                return status;
            })
            .onErrorReturn(Map.of(
                "error", "Failed to get pipeline status",
                "timestamp", System.currentTimeMillis()
            ));
    }

    // ==================== Pipeline Control Endpoints ====================

    @PostMapping("/pipeline/ingestion/{action}")
    @Operation(summary = "Control data ingestion", description = "Pause, resume, or trigger data ingestion")
    public Mono<Map<String, Object>> controlIngestion(@PathVariable String action) {
        return callServiceAction("data-ingestion", "/admin/" + action)
            .map(response -> {
                Map<String, Object> result = new HashMap<>();
                result.put("service", "data-ingestion");
                result.put("action", action);
                result.put("response", response);
                result.put("timestamp", System.currentTimeMillis());
                return result;
            });
    }

    @PostMapping("/pipeline/graph-sync/{action}")
    @Operation(summary = "Control graph sync", description = "Pause, resume, or trigger graph synchronization")
    public Mono<Map<String, Object>> controlGraphSync(@PathVariable String action) {
        String endpoint = switch (action) {
            case "pause" -> "/admin/sync/pause";
            case "resume" -> "/admin/sync/resume";
            case "trigger" -> "/admin/sync/trigger";
            default -> "/admin/sync/" + action;
        };
        
        return callServiceAction("graph-engine", endpoint)
            .map(response -> {
                Map<String, Object> result = new HashMap<>();
                result.put("service", "graph-engine");
                result.put("action", action);
                result.put("response", response);
                result.put("timestamp", System.currentTimeMillis());
                return result;
            });
    }

    // ==================== Helper Methods ====================

    private Mono<Map> getServiceStatus(String serviceName, String path) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        
        if (instances.isEmpty()) {
            return Mono.just(Map.of(
                "status", "not_registered",
                "message", "Service not found in registry"
            ));
        }

        ServiceInstance instance = instances.get(0);
        String url = instance.getUri().toString() + path;

        return webClientBuilder.build()
            .get()
            .uri(url)
            .retrieve()
            .bodyToMono(Map.class)
            .onErrorReturn(Map.of(
                "status", "unreachable",
                "message", "Failed to connect to service"
            ));
    }

    private Mono<Object> callServiceAction(String serviceName, String path) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        
        if (instances.isEmpty()) {
            return Mono.just(Map.of(
                "status", "error",
                "message", "Service not found in registry: " + serviceName
            ));
        }

        ServiceInstance instance = instances.get(0);
        String url = instance.getUri().toString() + path;

        return webClientBuilder.build()
            .post()
            .uri(url)
            .retrieve()
            .bodyToMono(Object.class)
            .onErrorReturn(Map.of(
                "status", "error",
                "message", "Failed to call service action"
            ));
    }
}
