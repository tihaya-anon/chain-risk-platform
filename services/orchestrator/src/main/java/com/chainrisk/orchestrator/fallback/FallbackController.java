package com.chainrisk.orchestrator.fallback;

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
public class FallbackController {
    
    /**
     * BFF service fallback
     */
    @GetMapping("/bff")
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
