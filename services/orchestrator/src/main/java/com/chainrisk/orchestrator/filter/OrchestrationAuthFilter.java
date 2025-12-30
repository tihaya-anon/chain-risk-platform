package com.chainrisk.orchestrator.filter;

import com.chainrisk.orchestrator.security.JwtTokenUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Authentication WebFilter for Orchestration endpoints
 * 
 * Since orchestration endpoints are handled directly by Spring MVC (not routed through Gateway),
 * we need a WebFilter to:
 * 1. Validate JWT token
 * 2. Extract user information
 * 3. Add X-User-* headers to the request
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class OrchestrationAuthFilter implements WebFilter {
    
    private final JwtTokenUtil jwtTokenUtil;
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        
        // Only apply to orchestration endpoints
        if (!path.startsWith("/api/v1/orchestration")) {
            return chain.filter(exchange);
        }
        
        // Check Authorization header
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("Missing or invalid Authorization header for path: {}", path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
        
        String token = authHeader.substring(7);
        
        try {
            // Validate token
            if (!jwtTokenUtil.validateToken(token)) {
                log.warn("Invalid or expired token for path: {}", path);
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }
            
            // Extract user information
            String userId = jwtTokenUtil.extractUserId(token);
            String username = jwtTokenUtil.extractUsername(token);
            String role = jwtTokenUtil.extractRole(token);
            
            log.debug("Authenticated user for orchestration: {} (ID: {}, Role: {})", username, userId, role);
            
            // Add user context headers
            ServerHttpRequest modifiedRequest = exchange.getRequest().mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Username", username)
                    .header("X-User-Role", role)
                    .build();
            
            return chain.filter(exchange.mutate().request(modifiedRequest).build());
            
        } catch (Exception e) {
            log.error("JWT validation error for path {}: {}", path, e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }
}
