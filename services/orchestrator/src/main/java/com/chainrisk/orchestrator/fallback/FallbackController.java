package com.chainrisk.orchestrator.fallback;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Fallback Controller
 * Provides fallback responses when services are unavailable
 */
@Slf4j
@RestController
@RequestMapping("/fallback")
@Tag(name = "Fallback", description = "Fallback endpoints for circuit breaker (internal use)")
@Hidden // Hide from Swagger UI as these are internal endpoints
public class FallbackController {
    
    /**
     * BFF service fallback
     */
    @GetMapping("/bff")
    @Operation(summary = "BFF fallback", description = "Returns fallback response when BFF service is unavailable")
    public ResponseEntity<Map<String, Object>> bffFallback() {
        log.warn("BFF service is unavailable, returning fallback response");
        
        Map<String, Object> response = Map.of(
                "error", "Service Temporarily Unavailable",
                "message", "The requested service is currently unavailable. Please try again later.",
                "fallback", true,
                "timestamp", System.currentTimeMillis()
        );
        
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }
    
    /**
     * Generic fallback
     */
    @GetMapping("/generic")
    @Operation(summary = "Generic fallback", description = "Returns generic fallback response for service errors")
    public ResponseEntity<Map<String, Object>> genericFallback() {
        log.warn("Service unavailable, returning generic fallback");
        
        Map<String, Object> response = Map.of(
                "error", "Service Error",
                "message", "An error occurred while processing your request.",
                "fallback", true,
                "timestamp", System.currentTimeMillis()
        );
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
