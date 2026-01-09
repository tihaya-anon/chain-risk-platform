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
@Tag(name = "Orchestration", description = "Aggregated endpoints that combine multiple API calls")
public class OrchestrationController {

    private final BffClient bffClient;

    /**
     * Get comprehensive address profile
     */
    @GetMapping("/address-profile/{address}")
    @Operation(summary = "Get address profile", description = "Address info + risk score + recent transfers")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Success"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public Mono<ResponseEntity<Map<String, Object>>> getAddressProfile(
            @PathVariable String address,
            @RequestParam(defaultValue = "ethereum") String network,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role) {

        log.info("Orchestrating address profile for: {}", address);
        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role);

        Mono<Map<String, Object>> addressInfoMono = bffClient.getAddressInfo(address, network, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Address info unavailable")));

        Mono<Map<String, Object>> riskScoreMono = bffClient.getRiskScore(address, network, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Risk score unavailable")));

        Mono<Map<String, Object>> transfersMono = bffClient.getAddressTransfers(address, network, 1, 10, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Transfers unavailable")));

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
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Orchestration failed", "message", e.getMessage())));
                });
    }

    /**
     * Get comprehensive address analysis with graph and alerts
     */
    @GetMapping("/address-analysis/{address}")
    @Operation(summary = "Get address analysis", description = "Full analysis: info + risk + graph + alerts")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Success"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public Mono<ResponseEntity<Map<String, Object>>> getAddressAnalysis(
            @PathVariable String address,
            @RequestParam(defaultValue = "ethereum") String network,
            @RequestParam(defaultValue = "1") int neighborDepth,
            @RequestParam(defaultValue = "20") int neighborLimit,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role) {

        log.info("Orchestrating address analysis for: {}", address);
        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role);

        // Basic info
        Mono<Map<String, Object>> addressInfoMono = bffClient.getAddressInfo(address, network, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Address info unavailable")));

        Mono<Map<String, Object>> riskScoreMono = bffClient.getRiskScore(address, network, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Risk score unavailable")));

        // Graph info
        Mono<Map<String, Object>> graphInfoMono = bffClient.getGraphAddressInfo(address, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Graph info unavailable")));

        Mono<Map<String, Object>> neighborsMono = bffClient.getGraphAddressNeighbors(address, neighborDepth,
                neighborLimit, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Neighbors unavailable")));

        Mono<List<String>> tagsMono = bffClient.getGraphAddressTags(address, userHeaders)
                .onErrorResume(e -> Mono.just(List.of()));

        Mono<Map<String, Object>> clusterMono = bffClient.getGraphAddressCluster(address, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Cluster info unavailable")));

        // Alerts for this address
        Mono<Map<String, Object>> alertsMono = bffClient.getAlertsByEntity(address, 1, 10, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("data", List.of(), "total", 0)));

        return Mono.zip(addressInfoMono, riskScoreMono, graphInfoMono, neighborsMono, tagsMono, clusterMono, alertsMono)
                .map(tuple -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("address", address);
                    result.put("network", network);

                    // Basic section
                    Map<String, Object> basic = new HashMap<>();
                    basic.put("addressInfo", tuple.getT1());
                    basic.put("riskScore", tuple.getT2());
                    result.put("basic", basic);

                    // Graph section
                    Map<String, Object> graph = new HashMap<>();
                    graph.put("graphInfo", tuple.getT3());
                    graph.put("neighbors", tuple.getT4());
                    graph.put("tags", tuple.getT5());
                    graph.put("cluster", tuple.getT6());
                    result.put("graph", graph);

                    // Alerts section
                    result.put("alerts", tuple.getT7());

                    result.put("orchestratedAt", System.currentTimeMillis());
                    return ResponseEntity.ok(result);
                })
                .onErrorResume(e -> {
                    log.error("Address analysis failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Orchestration failed", "message", e.getMessage())));
                });
    }

    /**
     * Find connection path between two addresses
     */
    @GetMapping("/connection/{fromAddress}/{toAddress}")
    @Operation(summary = "Find connection", description = "Shortest path + risk analysis")
    public Mono<ResponseEntity<Map<String, Object>>> findConnection(
            @PathVariable String fromAddress,
            @PathVariable String toAddress,
            @RequestParam(defaultValue = "5") int maxDepth,
            @RequestParam(defaultValue = "ethereum") String network,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role) {

        log.info("Finding connection from {} to {}", fromAddress, toAddress);
        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role);

        Mono<Map<String, Object>> pathMono = bffClient.getGraphPath(fromAddress, toAddress, maxDepth, userHeaders)
                .onErrorResume(e -> Mono.just(Map.of("error", "Path finding failed", "found", false)));

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
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Connection finding failed", "message", e.getMessage())));
                });
    }

    /**
     * Get high-risk network analysis
     */
    @GetMapping("/high-risk-network")
    @Operation(summary = "High-risk network", description = "Addresses above risk threshold")
    public Mono<ResponseEntity<Map<String, Object>>> getHighRiskNetwork(
            @RequestParam(defaultValue = "0.7") double threshold,
            @RequestParam(defaultValue = "20") int limit,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role) {

        log.info("Getting high-risk network, threshold: {}", threshold);
        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role);

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
                    log.error("High-risk network failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "High-risk network failed", "message", e.getMessage())));
                });
    }

    /**
     * Get dashboard statistics (aggregated from multiple services)
     */
    @GetMapping("/dashboard-stats")
    @Operation(summary = "Dashboard stats", description = "Aggregated statistics for dashboard")
    public Mono<ResponseEntity<Map<String, Object>>> getDashboardStats(
            @RequestParam(defaultValue = "24") int hours,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role) {

        log.info("Getting dashboard stats for {} hours", hours);
        Map<String, String> userHeaders = Map.of(
                "X-User-Id", userId,
                "X-User-Username", username,
                "X-User-Role", role);

        // Alert stats
        Mono<Map<String, Object>> alertStatsMono = bffClient.getAlertStats(hours, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Alert stats unavailable: {}", e.getMessage());
                    return Mono.just(Map.of(
                            "total", 0,
                            "bySeverity", Map.of(),
                            "byStatus", Map.of(),
                            "byType", Map.of(),
                            "averagePerHour", 0.0));
                });

        // Recent alerts
        Mono<Map<String, Object>> recentAlertsMono = bffClient.getRecentAlerts(5, userHeaders)
                .onErrorResume(e -> {
                    log.warn("Recent alerts unavailable: {}", e.getMessage());
                    return Mono.just(Map.of("data", List.of(), "total", 0));
                });

        // High-risk addresses count
        Mono<List<Map<String, Object>>> highRiskMono = bffClient.getGraphHighRiskAddresses(0.7, 100, userHeaders)
                .onErrorResume(e -> {
                    log.warn("High-risk addresses unavailable: {}", e.getMessage());
                    return Mono.just(List.of());
                });

        return Mono.zip(alertStatsMono, recentAlertsMono, highRiskMono)
                .map(tuple -> {
                    Map<String, Object> result = new HashMap<>();

                    // Alert statistics
                    result.put("alertStats", tuple.getT1());

                    // Recent alerts
                    result.put("recentAlerts", tuple.getT2());

                    // High-risk summary
                    List<Map<String, Object>> highRiskList = tuple.getT3();
                    Map<String, Object> highRiskSummary = new HashMap<>();
                    highRiskSummary.put("total", highRiskList.size());
                    highRiskSummary.put("critical", highRiskList.stream()
                            .filter(a -> {
                                Object score = a.get("riskScore");
                                if (score instanceof Number) {
                                    return ((Number) score).doubleValue() >= 0.9;
                                }
                                return false;
                            }).count());
                    result.put("highRiskSummary", highRiskSummary);

                    result.put("timeRange", Map.of("hours", hours));
                    result.put("orchestratedAt", System.currentTimeMillis());
                    return ResponseEntity.ok(result);
                })
                .onErrorResume(e -> {
                    log.error("Dashboard stats failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Dashboard stats failed", "message", e.getMessage())));
                });
    }

    /**
     * Batch address risk analysis
     */
    @PostMapping("/batch-risk-analysis")
    @Operation(summary = "Batch risk analysis", description = "Risk analysis for multiple addresses")
    public Mono<ResponseEntity<Map<String, Object>>> batchRiskAnalysis(
            @RequestBody Map<String, Object> request,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role) {
        return Mono.just(ResponseEntity.ok(Map.of("message", "Batch risk analysis")));
    }
}
