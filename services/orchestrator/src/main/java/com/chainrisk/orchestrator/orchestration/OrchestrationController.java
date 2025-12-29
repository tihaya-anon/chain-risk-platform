package com.chainrisk.orchestrator.orchestration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

/**
 * Orchestration Controller
 * Handles complex API orchestration scenarios
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/orchestration")
@RequiredArgsConstructor
public class OrchestrationController {
    
    private final BffClient bffClient;
    
    /**
     * Get comprehensive address profile
     * Orchestrates multiple API calls: address info + risk score + recent transfers
     */
    @GetMapping("/address-profile/{address}")
    public Mono<ResponseEntity<Map<String, Object>>> getAddressProfile(
            @PathVariable String address,
            @RequestParam(defaultValue = "ethereum") String network,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role
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
     * Batch address risk analysis
     * Orchestrates risk scoring for multiple addresses
     */
    @PostMapping("/batch-risk-analysis")
    public Mono<ResponseEntity<Map<String, Object>>> batchRiskAnalysis(
            @RequestBody Map<String, Object> request,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Username") String username,
            @RequestHeader("X-User-Role") String role
    ) {
        // Implementation for batch processing
        return Mono.just(ResponseEntity.ok(Map.of("message", "Batch risk analysis")));
    }
}
