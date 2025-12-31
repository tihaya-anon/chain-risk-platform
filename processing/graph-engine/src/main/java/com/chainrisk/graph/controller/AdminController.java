package com.chainrisk.graph.controller;

import com.chainrisk.graph.config.GraphProperties;
import com.chainrisk.graph.config.PipelineProperties;
import com.chainrisk.graph.model.dto.SyncStatusResponse;
import com.chainrisk.graph.service.impl.GraphSyncServiceImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Admin Controller for Graph Engine management.
 * Provides endpoints to control sync, clustering, and propagation.
 */
@Slf4j
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Tag(name = "Admin API", description = "Graph Engine administration and control")
public class AdminController {

    private final GraphSyncServiceImpl graphSyncService;
    private final PipelineProperties pipelineProperties;
    private final GraphProperties graphProperties;

    // ==================== Status Endpoints ====================

    @GetMapping("/status")
    @Operation(summary = "Get service status", description = "Returns current status of Graph Engine")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        
        // Nacos configuration
        status.put("nacosConfig", Map.of(
            "pipelineEnabled", pipelineProperties.isEnabled(),
            "graphSyncEnabled", pipelineProperties.getGraphSync().isEnabled(),
            "clusteringEnabled", pipelineProperties.getClustering().isEnabled(),
            "propagationEnabled", pipelineProperties.getPropagation().isEnabled()
        ));
        
        // Manual control
        status.put("manualControl", Map.of(
            "syncPaused", graphSyncService.isManualPaused()
        ));
        
        // Effective status
        boolean effectivelyEnabled = pipelineProperties.isEnabled() 
            && pipelineProperties.getGraphSync().isEnabled()
            && !graphSyncService.isManualPaused();
            
        status.put("effectiveStatus", Map.of(
            "syncRunning", graphSyncService.isSyncRunning(),
            "syncEnabled", effectivelyEnabled,
            "syncInterval", pipelineProperties.getGraphSync().getIntervalMs(),
            "syncBatchSize", pipelineProperties.getGraphSync().getBatchSize()
        ));
        
        // Sync status
        SyncStatusResponse syncStatus = graphSyncService.getSyncStatus();
        status.put("syncStatus", syncStatus);
        
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

    // ==================== Sync Control Endpoints ====================

    @PostMapping("/sync/pause")
    @Operation(summary = "Pause sync", description = "Manually pause graph synchronization")
    public ResponseEntity<Map<String, Object>> pauseSync() {
        graphSyncService.pause();
        log.info("Graph sync paused via Admin API");
        
        return ResponseEntity.ok(Map.of(
            "action", "pause",
            "status", "paused",
            "message", "Graph sync has been paused manually",
            "timestamp", System.currentTimeMillis()
        ));
    }

    @PostMapping("/sync/resume")
    @Operation(summary = "Resume sync", description = "Resume graph synchronization")
    public ResponseEntity<Map<String, Object>> resumeSync() {
        graphSyncService.resume();
        log.info("Graph sync resumed via Admin API");
        
        return ResponseEntity.ok(Map.of(
            "action", "resume",
            "status", "running",
            "message", "Graph sync has been resumed",
            "timestamp", System.currentTimeMillis()
        ));
    }

    @PostMapping("/sync/trigger")
    @Operation(summary = "Trigger sync", description = "Manually trigger graph synchronization")
    public ResponseEntity<Map<String, Object>> triggerSync() {
        log.info("Manual sync triggered via Admin API");
        
        SyncStatusResponse result = graphSyncService.triggerSync();
        
        return ResponseEntity.ok(Map.of(
            "action", "trigger",
            "status", "started",
            "result", result,
            "timestamp", System.currentTimeMillis()
        ));
    }
}
