package com.chainrisk.graph.filter;

import com.chainrisk.graph.config.RateLimitConfig;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Rate limiting filter for Graph Service
 * Applies per-IP rate limiting based on route patterns
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class RateLimitFilter implements Filter {

    private final RateLimitConfig rateLimitConfig;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String path = httpRequest.getRequestURI();
        String clientIp = getClientIp(httpRequest);
        String routePattern = rateLimitConfig.getRoutePattern(path);

        RateLimiter rateLimiter = rateLimitConfig.getRateLimiter(routePattern, clientIp);

        try {
            RateLimiter.waitForPermission(rateLimiter);
            chain.doFilter(request, response);
        } catch (RequestNotPermitted e) {
            log.warn("Rate limit exceeded for IP: {} on route: {}", clientIp, routePattern);
            httpResponse.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
            httpResponse.getWriter().write(
                "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many requests. Please try again later.\"}"
            );
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }
}
