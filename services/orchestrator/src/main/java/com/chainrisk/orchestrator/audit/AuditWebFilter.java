package com.chainrisk.orchestrator.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

/**
 * WebFlux filter for automatic audit logging
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class AuditWebFilter implements WebFilter {

    private final AuditLogger auditLogger;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        long startTime = System.currentTimeMillis();
        ServerHttpRequest request = exchange.getRequest();
        
        String userId = extractUserId(request);
        String ipAddress = extractIpAddress(request);
        String resource = request.getURI().getPath();
        String method = request.getMethod() != null ? request.getMethod().name() : "UNKNOWN";

        return chain.filter(exchange)
                .doFinally(signalType -> {
                    long responseTime = System.currentTimeMillis() - startTime;
                    Integer statusCode = exchange.getResponse().getStatusCode() != null 
                            ? exchange.getResponse().getStatusCode().value() 
                            : 500;
                    
                    // Use AuditLogger's helper method
                    auditLogger.logApiRequest(userId, ipAddress, method, resource, statusCode, responseTime);
                });
    }

    private String extractUserId(ServerHttpRequest request) {
        // Try X-User-Id header
        String userId = request.getHeaders().getFirst("X-User-Id");
        if (userId != null && !userId.isEmpty()) {
            return userId;
        }
        return "anonymous";
    }

    private String extractIpAddress(ServerHttpRequest request) {
        // Check X-Forwarded-For header
        String forwarded = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isEmpty()) {
            return forwarded.split(",")[0].trim();
        }

        // Check X-Real-IP header
        String realIp = request.getHeaders().getFirst("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp;
        }

        // Get remote address
        if (request.getRemoteAddress() != null) {
            return request.getRemoteAddress().getAddress().getHostAddress();
        }
        
        return "unknown";
    }
}
