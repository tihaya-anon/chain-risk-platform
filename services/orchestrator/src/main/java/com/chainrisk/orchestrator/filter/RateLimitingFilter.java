package com.chainrisk.orchestrator.filter;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.reactor.ratelimiter.operator.RateLimiterOperator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * Rate Limiting Filter
 * Applies rate limiting to protect backend services
 */
@Slf4j
@Component
public class RateLimitingFilter implements GatewayFilter, Ordered {
    
    private final RateLimiterRegistry rateLimiterRegistry;
    
    public RateLimitingFilter() {
        RateLimiterConfig config = RateLimiterConfig.custom()
                .limitForPeriod(100)
                .limitRefreshPeriod(Duration.ofSeconds(1))
                .timeoutDuration(Duration.ZERO)
                .build();
        
        this.rateLimiterRegistry = RateLimiterRegistry.of(config);
    }
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        String rateLimiterKey = userId != null ? "user-" + userId : "anonymous";
        
        RateLimiter rateLimiter = rateLimiterRegistry.rateLimiter(rateLimiterKey);
        
        return chain.filter(exchange)
                .transformDeferred(RateLimiterOperator.of(rateLimiter))
                .onErrorResume(throwable -> {
                    log.warn("Rate limit exceeded for: {}", rateLimiterKey);
                    exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                    return exchange.getResponse().setComplete();
                });
    }
    
    @Override
    public int getOrder() {
        return -1; // High priority
    }
}
