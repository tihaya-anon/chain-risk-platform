package com.chainrisk.graph.controller;

import com.chainrisk.graph.config.GraphProperties;
import com.chainrisk.graph.config.PipelineProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Admin Controller for Graph Service management.
 */
@Slf4j
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Tag(name = "Admin API", description = "Graph Service administration and control")
public class AdminController {

    private final PipelineProperties pipelineProperties;
    private final GraphProperties graphProperties;

    // ==================== Status Endpoints ====================

    @GetMapping("/status")
    @Operation(summary = "Get service status", description = "Returns current status of Graph Service")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        
        // Nacos configuration
        status.put("nacosConfig", Map.of(
            "pipelineEnabled", pipelineProperties.isEnabled(),
            "clusteringEnabled", pipelineProperties.getClustering().isEnabled(),
            "propagationEnabled", pipelineProperties.getPropagation().isEnabled()
        ));
        
        status.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(status);
    }

    @GetMapping("/config")
    @Operation(summary = "Get configuration", description = "Returns current configuration from Nacos")
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("pipeline", pipelineProperties);
        config.put("graph", graphProperties);
        return ResponseEntity.ok(config);
    }
}
