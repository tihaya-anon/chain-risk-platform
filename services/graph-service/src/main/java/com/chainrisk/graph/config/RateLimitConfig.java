package com.chainrisk.graph.config;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate Limiting Configuration for Graph Service
 * Graph queries are resource-intensive, so lower limits are applied
 */
@Slf4j
@Configuration
public class RateLimitConfig {

    /**
     * Route-specific rate limits
     * Graph operations are more expensive, hence lower limits
     */
    private static final Map<String, Integer> ROUTE_LIMITS = Map.of(
        "graph", 30,      // /api/v1/graph/* - 30/min (expensive operations)
        "tags", 60,       // /api/v1/tags/* - 60/min
        "clusters", 30,   // /api/v1/clusters/* - 30/min
        "paths", 20,      // path finding - 20/min (very expensive)
        "health", 1000,   // health endpoints - 1000/min
        "default", 50     // default rate limit
    );

    private final ConcurrentHashMap<String, RateLimiterRegistry> perIpRegistries = new ConcurrentHashMap<>();

    @Bean
    public RateLimiterRegistry graphRateLimiterRegistry() {
        RateLimiterConfig config = RateLimiterConfig.custom()
                .limitForPeriod(30)
                .limitRefreshPeriod(Duration.ofMinutes(1))
                .timeoutDuration(Duration.ofMillis(100))
                .build();
        return RateLimiterRegistry.of(config);
    }

    /**
     * Get rate limiter for a specific route pattern and client IP
     */
    public RateLimiter getRateLimiter(String routePattern, String clientIp) {
        int limit = ROUTE_LIMITS.getOrDefault(routePattern, ROUTE_LIMITS.get("default"));
        
        String registryKey = routePattern + "-" + clientIp;
        
        RateLimiterRegistry registry = perIpRegistries.computeIfAbsent(registryKey, key -> {
            RateLimiterConfig config = RateLimiterConfig.custom()
                    .limitForPeriod(limit)
                    .limitRefreshPeriod(Duration.ofMinutes(1))
                    .timeoutDuration(Duration.ofMillis(100))
                    .build();
            return RateLimiterRegistry.of(config);
        });

        return registry.rateLimiter(registryKey);
    }

    /**
     * Determine route pattern from request path
     */
    public String getRoutePattern(String path) {
        if (path == null) return "default";
        
        String lowerPath = path.toLowerCase();
        
        if (lowerPath.contains("/health") || lowerPath.contains("/metrics")) {
            return "health";
        }
        if (lowerPath.contains("/path") || lowerPath.contains("/shortest")) {
            return "paths";
        }
        if (lowerPath.contains("/cluster")) {
            return "clusters";
        }
        if (lowerPath.contains("/tag")) {
            return "tags";
        }
        if (lowerPath.contains("/graph") || lowerPath.contains("/neighbor") || lowerPath.contains("/address")) {
            return "graph";
        }
        
        return "default";
    }

    /**
     * Get rate limits for monitoring
     */
    public Map<String, Integer> getRouteLimits() {
        return ROUTE_LIMITS;
    }
}
