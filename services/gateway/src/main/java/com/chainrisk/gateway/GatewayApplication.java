package com.chainrisk.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * API Gateway Application
 * 
 * This gateway handles:
 * - JWT authentication
 * - Request routing to BFF
 * - Adding user context headers (X-User-Id, X-User-Username, X-User-Role)
 * - Rate limiting
 * - Request/Response logging
 */
@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
