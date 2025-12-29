package com.chainrisk.orchestrator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Orchestrator Application
 * 
 * This service combines:
 * 1. API Gateway - JWT authentication, routing, user context injection
 * 2. API Orchestration - Coordinating multiple API calls
 * 3. Resilience - Rate limiting, circuit breaker, fallback
 */
@SpringBootApplication
public class OrchestratorApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrchestratorApplication.class, args);
    }
}
