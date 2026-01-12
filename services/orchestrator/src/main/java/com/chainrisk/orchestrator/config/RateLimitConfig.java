package com.chainrisk.orchestrator.config;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate Limiting Configuration
 * Provides route-specific rate limiters for API protection
 */
@Slf4j
@Configuration
public class RateLimitConfig {

    /**
     * Rate limit configurations per route pattern
     */
    @Getter
    public static class RouteLimit {
        private final int limitForPeriod;
        private final Duration limitRefreshPeriod;
        private final Duration timeoutDuration;

        public RouteLimit(int limitForPeriod, Duration limitRefreshPeriod, Duration timeoutDuration) {
            this.limitForPeriod = limitForPeriod;
            this.limitRefreshPeriod = limitRefreshPeriod;
            this.timeoutDuration = timeoutDuration;
        }
    }

    // Route-specific rate limits
    private static final Map<String, RouteLimit> ROUTE_LIMITS = Map.of(
        "address", new RouteLimit(100, Duration.ofMinutes(1), Duration.ofMillis(100)),   // /api/v1/address/* - 100/min
        "risk", new RouteLimit(50, Duration.ofMinutes(1), Duration.ofMillis(100)),       // /api/v1/risk/* - 50/min
        "graph", new RouteLimit(30, Duration.ofMinutes(1), Duration.ofMillis(100)),      // /api/v1/graph/* - 30/min
        "alerts", new RouteLimit(60, Duration.ofMinutes(1), Duration.ofMillis(100)),     // /api/v1/alerts/* - 60/min
        "health", new RouteLimit(1000, Duration.ofMinutes(1), Duration.ofMillis(10)),    // health endpoints - 1000/min
        "default", new RouteLimit(100, Duration.ofMinutes(1), Duration.ofMillis(100))    // default rate limit
    );

    private final ConcurrentHashMap<String, RateLimiterRegistry> perIpRegistries = new ConcurrentHashMap<>();

    @Bean
    public RateLimiterRegistry defaultRateLimiterRegistry() {
        RateLimiterConfig config = RateLimiterConfig.custom()
                .limitForPeriod(100)
                .limitRefreshPeriod(Duration.ofMinutes(1))
                .timeoutDuration(Duration.ofMillis(100))
                .build();
        return RateLimiterRegistry.of(config);
    }

    /**
     * Get rate limiter for a specific route pattern and client IP
     */
    public RateLimiter getRateLimiter(String routePattern, String clientIp) {
        RouteLimit limit = ROUTE_LIMITS.getOrDefault(routePattern, ROUTE_LIMITS.get("default"));
        
        String registryKey = routePattern + "-" + clientIp;
        
        RateLimiterRegistry registry = perIpRegistries.computeIfAbsent(registryKey, key -> {
            RateLimiterConfig config = RateLimiterConfig.custom()
                    .limitForPeriod(limit.getLimitForPeriod())
                    .limitRefreshPeriod(limit.getLimitRefreshPeriod())
                    .timeoutDuration(limit.getTimeoutDuration())
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
        if (lowerPath.contains("/address")) {
            return "address";
        }
        if (lowerPath.contains("/risk")) {
            return "risk";
        }
        if (lowerPath.contains("/graph")) {
            return "graph";
        }
        if (lowerPath.contains("/alert")) {
            return "alerts";
        }
        
        return "default";
    }

    /**
     * Get rate limit info for monitoring/debugging
     */
    public Map<String, RouteLimit> getRouteLimits() {
        return ROUTE_LIMITS;
    }

    /**
     * Cleanup stale rate limiter entries (call periodically)
     */
    public void cleanupStaleEntries() {
        // In production, implement TTL-based cleanup
        log.debug("Rate limiter cleanup - current entries: {}", perIpRegistries.size());
    }
}
