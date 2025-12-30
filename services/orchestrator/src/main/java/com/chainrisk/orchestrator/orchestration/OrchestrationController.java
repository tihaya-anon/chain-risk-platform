package com.chainrisk.orchestrator.orchestration;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Orchestration Controller
 * Handles complex API orchestration scenarios
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/orchestration")
@RequiredArgsConstructor
@Tag(name = "Orchestration", description = "Aggregated endpoints that combine multiple API calls for complex queries")
public class OrchestrationController {
    
    private final BffClient bffClient;
    
    /**
     * Get comprehensive address profile
     * Orchestrates multiple API calls: address info + risk score + recent transfers
     */
    @GetMapping("/address-profile/{address}")
    @Operation(
            summary = "Get address profile",
            description = "Orchestrates multiple API calls to get a comprehensive address profile including basic info, risk score, and recent transfers"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Address profile retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Invalid or missing JWT token"),
            @ApiResponse(responseCode = "500", description = "Internal server error during orchestration")
    })
    public Mono<ResponseEntity<Map<String, Object>>> getAddressProfile(
            @Parameter(description = "Blockchain address (0x-prefixed)", required = true)
            @PathVariable String address,
            @Parameter(description = "Blockchain network", example = "ethereum")
            @RequestParam(defaultValue = "ethereum") String network,
            @Parameter(hidden = true) @RequestHeader("X-User-Id") String userId,
            @Parameter(hidden = true) @RequestHeader("X-User-Username") String username,
            @Parameter(hidden = true) @RequestHeader("X-User-Role") String role
    ) {
        log.info("Orchestrating address profile for: {}", address);
        
        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role
        );
        
        // Parallel API calls
        Mono<Map<String, Object>> addressInfoMono = bffClient.getAddressInfo(address, network, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Address info failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Address info unavailable"));
                });
        
        Mono<Map<String, Object>> riskScoreMono = bffClient.getRiskScore(address, network, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Risk score failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Risk score unavailable"));
                });
        
        Mono<Map<String, Object>> transfersMono = bffClient.getAddressTransfers(address, network, 1, 10, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Transfers failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Transfers unavailable"));
                });
        
        // Combine results
        return Mono.zip(addressInfoMono, riskScoreMono, transfersMono)
                .map(tuple -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("address", address);
                    result.put("network", network);
                    result.put("addressInfo", tuple.getT1());
                    result.put("riskScore", tuple.getT2());
                    result.put("recentTransfers", tuple.getT3());
                    result.put("orchestratedAt", System.currentTimeMillis());
                    return ResponseEntity.ok(result);
                })
                .onErrorResume(e -> {
                    log.error("Orchestration failed: {}", e.getMessage());
                    Map<String, Object> error = Map.of(
                            "error", "Orchestration failed",
                            "message", e.getMessage()
                    );
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error));
                });
    }

    /**
     * Get comprehensive address analysis with graph data
     * Orchestrates: address info + risk score + graph info + neighbors + cluster
     */
    @GetMapping("/address-analysis/{address}")
    @Operation(
            summary = "Get comprehensive address analysis",
            description = "Orchestrates multiple API calls to get comprehensive address analysis including basic info, risk score, graph data, neighbors, tags, and cluster information"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Address analysis retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Invalid or missing JWT token"),
            @ApiResponse(responseCode = "500", description = "Internal server error during orchestration")
    })
    public Mono<ResponseEntity<Map<String, Object>>> getAddressAnalysis(
            @Parameter(description = "Blockchain address (0x-prefixed)", required = true)
            @PathVariable String address,
            @Parameter(description = "Blockchain network", example = "ethereum")
            @RequestParam(defaultValue = "ethereum") String network,
            @Parameter(description = "Neighbor search depth (1-3)", example = "1")
            @RequestParam(defaultValue = "1") int neighborDepth,
            @Parameter(description = "Maximum number of neighbors to return", example = "20")
            @RequestParam(defaultValue = "20") int neighborLimit,
            @Parameter(hidden = true) @RequestHeader("X-User-Id") String userId,
            @Parameter(hidden = true) @RequestHeader("X-User-Username") String username,
            @Parameter(hidden = true) @RequestHeader("X-User-Role") String role
    ) {
        log.info("Orchestrating comprehensive address analysis for: {}", address);

        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role
        );

        // Parallel API calls - basic info
        Mono<Map<String, Object>> addressInfoMono = bffClient.getAddressInfo(address, network, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Address info failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Address info unavailable"));
                });

        Mono<Map<String, Object>> riskScoreMono = bffClient.getRiskScore(address, network, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Risk score failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Risk score unavailable"));
                });

        // Parallel API calls - graph info
        Mono<Map<String, Object>> graphInfoMono = bffClient.getGraphAddressInfo(address, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Graph address info failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Graph info unavailable"));
                });

        Mono<Map<String, Object>> neighborsMono = bffClient.getGraphAddressNeighbors(address, neighborDepth, neighborLimit, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Graph neighbors failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Neighbors unavailable"));
                });

        Mono<List<String>> tagsMono = bffClient.getGraphAddressTags(address, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Graph tags failed: {}", e.getMessage());
                    return Mono.just(List.of());
                });

        Mono<Map<String, Object>> clusterMono = bffClient.getGraphAddressCluster(address, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Graph cluster failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Cluster info unavailable"));
                });

        // Combine all results
        return Mono.zip(addressInfoMono, riskScoreMono, graphInfoMono, neighborsMono, tagsMono, clusterMono)
                .map(tuple -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("address", address);
                    result.put("network", network);

                    // Basic info section
                    Map<String, Object> basicInfo = new HashMap<>();
                    basicInfo.put("addressInfo", tuple.getT1());
                    basicInfo.put("riskScore", tuple.getT2());
                    result.put("basic", basicInfo);

                    // Graph info section
                    Map<String, Object> graphSection = new HashMap<>();
                    graphSection.put("graphInfo", tuple.getT3());
                    graphSection.put("neighbors", tuple.getT4());
                    graphSection.put("tags", tuple.getT5());
                    graphSection.put("cluster", tuple.getT6());
                    result.put("graph", graphSection);

                    result.put("orchestratedAt", System.currentTimeMillis());
                    return ResponseEntity.ok(result);
                })
                .onErrorResume(e -> {
                    log.error("Address analysis orchestration failed: {}", e.getMessage());
                    Map<String, Object> error = Map.of(
                            "error", "Orchestration failed",
                            "message", e.getMessage()
                    );
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error));
                });
    }

    /**
     * Find connection path between two addresses with risk analysis
     * Orchestrates: path finding + risk scores for addresses in path
     */
    @GetMapping("/connection/{fromAddress}/{toAddress}")
    @Operation(
            summary = "Find connection between addresses",
            description = "Finds the shortest path between two addresses and provides risk analysis for both endpoints"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Connection analysis completed"),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Invalid or missing JWT token"),
            @ApiResponse(responseCode = "500", description = "Internal server error during orchestration")
    })
    public Mono<ResponseEntity<Map<String, Object>>> findConnection(
            @Parameter(description = "Source address (0x-prefixed)", required = true)
            @PathVariable String fromAddress,
            @Parameter(description = "Target address (0x-prefixed)", required = true)
            @PathVariable String toAddress,
            @Parameter(description = "Maximum path depth to search", example = "5")
            @RequestParam(defaultValue = "5") int maxDepth,
            @Parameter(description = "Blockchain network", example = "ethereum")
            @RequestParam(defaultValue = "ethereum") String network,
            @Parameter(hidden = true) @RequestHeader("X-User-Id") String userId,
            @Parameter(hidden = true) @RequestHeader("X-User-Username") String username,
            @Parameter(hidden = true) @RequestHeader("X-User-Role") String role
    ) {
        log.info("Finding connection from {} to {}", fromAddress, toAddress);

        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role
        );

        // Get path between addresses
        Mono<Map<String, Object>> pathMono = bffClient.getGraphPath(fromAddress, toAddress, maxDepth, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Path finding failed: {}", e.getMessage());
                    return Mono.just(Map.of("error", "Path finding failed", "found", false));
                });

        // Get risk scores for both endpoints
        Mono<Map<String, Object>> fromRiskMono = bffClient.getRiskScore(fromAddress, network, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Risk score unavailable")));

        Mono<Map<String, Object>> toRiskMono = bffClient.getRiskScore(toAddress, network, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Risk score unavailable")));

        return Mono.zip(pathMono, fromRiskMono, toRiskMono)
                .map(tuple -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("fromAddress", fromAddress);
                    result.put("toAddress", toAddress);
                    result.put("path", tuple.getT1());
                    result.put("fromAddressRisk", tuple.getT2());
                    result.put("toAddressRisk", tuple.getT3());
                    result.put("orchestratedAt", System.currentTimeMillis());
                    return ResponseEntity.ok(result);
                })
                .onErrorResume(e -> {
                    log.error("Connection finding failed: {}", e.getMessage());
                    Map<String, Object> error = Map.of(
                            "error", "Connection finding failed",
                            "message", e.getMessage()
                    );
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error));
                });
    }

    /**
     * Get high-risk network analysis
     * Orchestrates: high-risk addresses + their clusters
     */
    @GetMapping("/high-risk-network")
    @Operation(
            summary = "Get high-risk network analysis",
            description = "Retrieves addresses with risk scores above the specified threshold"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "High-risk network analysis completed"),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Invalid or missing JWT token"),
            @ApiResponse(responseCode = "500", description = "Internal server error during orchestration")
    })
    public Mono<ResponseEntity<Map<String, Object>>> getHighRiskNetwork(
            @Parameter(description = "Risk score threshold (0.0 - 1.0)", example = "0.7")
            @RequestParam(defaultValue = "0.7") double threshold,
            @Parameter(description = "Maximum number of addresses to return", example = "20")
            @RequestParam(defaultValue = "20") int limit,
            @Parameter(hidden = true) @RequestHeader("X-User-Id") String userId,
            @Parameter(hidden = true) @RequestHeader("X-User-Username") String username,
            @Parameter(hidden = true) @RequestHeader("X-User-Role") String role
    ) {
        log.info("Getting high-risk network analysis, threshold: {}", threshold);

        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role
        );

        return bffClient.getGraphHighRiskAddresses(threshold, limit, userHeaders)
                .map(addresses -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("threshold", threshold);
                    result.put("count", addresses.size());
                    result.put("highRiskAddresses", addresses);
                    result.put("orchestratedAt", System.currentTimeMillis());
                    return ResponseEntity.ok(result);
                })
                .onErrorResume(e -> {
                    log.error("High-risk network analysis failed: {}", e.getMessage());
                    Map<String, Object> error = Map.of(
                            "error", "High-risk network analysis failed",
                            "message", e.getMessage()
                    );
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error));
                });
    }
    
    /**
     * Batch address risk analysis
     * Orchestrates risk scoring for multiple addresses
     */
    @PostMapping("/batch-risk-analysis")
    @Operation(
            summary = "Batch address risk analysis",
            description = "Performs risk analysis for multiple addresses in a single request"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Batch analysis completed"),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Invalid or missing JWT token"),
            @ApiResponse(responseCode = "500", description = "Internal server error during orchestration")
    })
    public Mono<ResponseEntity<Map<String, Object>>> batchRiskAnalysis(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "List of addresses to analyze",
                    required = true,
                    content = @Content(schema = @Schema(implementation = BatchRiskRequest.class))
            )
            @RequestBody Map<String, Object> request,
            @Parameter(hidden = true) @RequestHeader("X-User-Id") String userId,
            @Parameter(hidden = true) @RequestHeader("X-User-Username") String username,
            @Parameter(hidden = true) @RequestHeader("X-User-Role") String role
    ) {
        // Implementation for batch processing
        return Mono.just(ResponseEntity.ok(Map.of("message", "Batch risk analysis")));
    }

    /**
     * Schema class for batch risk analysis request
     */
    @Schema(description = "Batch risk analysis request")
    private static class BatchRiskRequest {
        @Schema(description = "List of addresses to analyze", example = "[\"0x123...\", \"0x456...\"]")
        public List<String> addresses;
        
        @Schema(description = "Blockchain network", example = "ethereum")
        public String network;
    }
}
