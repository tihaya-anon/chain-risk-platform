package com.chainrisk.graph.controller;

import com.chainrisk.graph.model.dto.*;
import com.chainrisk.graph.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Graph Engine API
 */
@Slf4j
@RestController
@RequestMapping("/api/graph")
@RequiredArgsConstructor
@Tag(name = "Graph API", description = "Address graph analysis and clustering operations")
public class GraphController {

    private final GraphQueryService graphQueryService;
    private final GraphSyncService graphSyncService;
    private final ClusteringService clusteringService;
    private final TagPropagationService tagPropagationService;

    // ==================== Address Queries ====================

    @GetMapping("/address/{address}")
    @Operation(summary = "Get address information", description = "Get detailed information about an address including tags and risk score")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Address found"),
            @ApiResponse(responseCode = "404", description = "Address not found")
    })
    public ResponseEntity<AddressInfoResponse> getAddressInfo(
            @Parameter(description = "Blockchain address (0x-prefixed)")
            @PathVariable String address) {
        
        return graphQueryService.getAddressInfo(address)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/address/{address}/neighbors")
    @Operation(summary = "Get address neighbors", description = "Get addresses that have transferred to/from this address")
    public ResponseEntity<AddressNeighborsResponse> getNeighbors(
            @Parameter(description = "Blockchain address")
            @PathVariable String address,
            @Parameter(description = "Search depth (1-3)")
            @RequestParam(defaultValue = "1") @Min(1) @Max(3) int depth,
            @Parameter(description = "Maximum number of neighbors to return")
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        
        AddressNeighborsResponse response = graphQueryService.getNeighbors(address, depth, limit);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/address/{address}/cluster")
    @Operation(summary = "Get address cluster", description = "Get the cluster this address belongs to")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cluster found"),
            @ApiResponse(responseCode = "404", description = "Address not in any cluster")
    })
    public ResponseEntity<ClusterResponse> getAddressCluster(
            @Parameter(description = "Blockchain address")
            @PathVariable String address) {
        
        return graphQueryService.getClusterForAddress(address)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== Tag Management ====================

    @GetMapping("/address/{address}/tags")
    @Operation(summary = "Get address tags", description = "Get all tags associated with an address")
    public ResponseEntity<List<String>> getAddressTags(
            @Parameter(description = "Blockchain address")
            @PathVariable String address) {
        
        List<String> tags = tagPropagationService.getTags(address);
        return ResponseEntity.ok(tags);
    }

    @PostMapping("/address/{address}/tags")
    @Operation(summary = "Add tags to address", description = "Add one or more tags to an address (manual tagging)")
    public ResponseEntity<AddressInfoResponse> addTags(
            @Parameter(description = "Blockchain address")
            @PathVariable String address,
            @Valid @RequestBody AddTagRequest request) {
        
        boolean success = tagPropagationService.addTags(address, request.getTags());
        if (!success) {
            return ResponseEntity.badRequest().build();
        }
        
        return graphQueryService.getAddressInfo(address)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/address/{address}/tags/{tag}")
    @Operation(summary = "Remove tag from address", description = "Remove a specific tag from an address")
    public ResponseEntity<Void> removeTag(
            @Parameter(description = "Blockchain address")
            @PathVariable String address,
            @Parameter(description = "Tag to remove")
            @PathVariable String tag) {
        
        boolean success = tagPropagationService.removeTag(address, tag);
        return success ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    // ==================== Path Finding ====================

    @GetMapping("/path/{fromAddress}/{toAddress}")
    @Operation(summary = "Find path between addresses", description = "Find the shortest path of transfers between two addresses")
    public ResponseEntity<PathResponse> findPath(
            @Parameter(description = "Source address")
            @PathVariable String fromAddress,
            @Parameter(description = "Target address")
            @PathVariable String toAddress,
            @Parameter(description = "Maximum path depth")
            @RequestParam(defaultValue = "5") @Min(1) @Max(10) int maxDepth) {
        
        PathResponse response = graphQueryService.findPath(fromAddress, toAddress, maxDepth);
        return ResponseEntity.ok(response);
    }

    // ==================== Cluster Operations ====================

    @GetMapping("/cluster/{clusterId}")
    @Operation(summary = "Get cluster by ID", description = "Get cluster information by cluster ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cluster found"),
            @ApiResponse(responseCode = "404", description = "Cluster not found")
    })
    public ResponseEntity<ClusterResponse> getCluster(
            @Parameter(description = "Cluster ID")
            @PathVariable String clusterId) {
        
        return graphQueryService.getClusterById(clusterId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/cluster/run")
    @Operation(summary = "Run clustering algorithm", description = "Trigger address clustering based on common input heuristic")
    public ResponseEntity<ClusteringResultResponse> runClustering() {
        log.info("Clustering triggered via API");
        ClusteringResultResponse result = clusteringService.runClustering();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/cluster/manual")
    @Operation(summary = "Manually cluster addresses", description = "Create a cluster from a list of addresses")
    public ResponseEntity<ClusteringResultResponse> manualCluster(
            @RequestBody List<String> addresses) {
        
        ClusteringResultResponse result = clusteringService.clusterAddresses(addresses);
        return ResponseEntity.ok(result);
    }

    // ==================== Tag Propagation ====================

    @PostMapping("/propagate")
    @Operation(summary = "Propagate risk tags", description = "Propagate risk scores and tags from high-risk addresses to neighbors")
    public ResponseEntity<PropagationResultResponse> propagateTags() {
        log.info("Tag propagation triggered via API");
        PropagationResultResponse result = tagPropagationService.propagateAllTags();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/propagate/{address}")
    @Operation(summary = "Propagate from address", description = "Propagate risk from a specific source address")
    public ResponseEntity<PropagationResultResponse> propagateFromAddress(
            @Parameter(description = "Source address")
            @PathVariable String address) {
        
        PropagationResultResponse result = tagPropagationService.propagateFromAddress(address);
        return ResponseEntity.ok(result);
    }

    // ==================== Sync Operations ====================

    @GetMapping("/sync/status")
    @Operation(summary = "Get sync status", description = "Get current synchronization status between PostgreSQL and Neo4j")
    public ResponseEntity<SyncStatusResponse> getSyncStatus() {
        SyncStatusResponse status = graphSyncService.getSyncStatus();
        return ResponseEntity.ok(status);
    }

    @PostMapping("/sync")
    @Operation(summary = "Trigger sync", description = "Manually trigger data synchronization from PostgreSQL to Neo4j")
    public ResponseEntity<SyncStatusResponse> triggerSync() {
        log.info("Sync triggered via API");
        SyncStatusResponse result = graphSyncService.triggerSync();
        return ResponseEntity.ok(result);
    }

    // ==================== Search Operations ====================

    @GetMapping("/search/tag/{tag}")
    @Operation(summary = "Search by tag", description = "Find addresses with a specific tag")
    public ResponseEntity<List<AddressInfoResponse>> searchByTag(
            @Parameter(description = "Tag to search for")
            @PathVariable String tag,
            @Parameter(description = "Maximum results")
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        
        List<AddressInfoResponse> results = graphQueryService.searchByTag(tag, limit);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/search/high-risk")
    @Operation(summary = "Get high-risk addresses", description = "Find addresses with risk score above threshold")
    public ResponseEntity<List<AddressInfoResponse>> getHighRiskAddresses(
            @Parameter(description = "Risk score threshold (0.0 - 1.0)")
            @RequestParam(defaultValue = "0.6") @Min(0) @Max(1) double threshold,
            @Parameter(description = "Maximum results")
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        
        List<AddressInfoResponse> results = graphQueryService.getHighRiskAddresses(threshold, limit);
        return ResponseEntity.ok(results);
    }
}
