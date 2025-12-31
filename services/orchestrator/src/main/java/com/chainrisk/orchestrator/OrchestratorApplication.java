package com.chainrisk.orchestrator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Orchestrator Application
 * 
 * This service combines:
 * 1. API Gateway - JWT authentication, routing, user context injection
 * 2. API Orchestration - Coordinating multiple API calls
 * 3. Resilience - Rate limiting, circuit breaker, fallback
 * 4. Service Discovery - Nacos integration for service registration and discovery
 * 5. Dynamic Configuration - Nacos config center for runtime configuration
 */
@SpringBootApplication
@EnableDiscoveryClient
@ConfigurationPropertiesScan
public class OrchestratorApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrchestratorApplication.class, args);
    }
}
