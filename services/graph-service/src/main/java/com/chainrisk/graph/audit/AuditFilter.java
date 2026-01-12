package com.chainrisk.graph.audit;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Audit logging filter for Graph Service
 * Logs all API requests for security audit
 */
@Slf4j
@Component
@Order(2) // After rate limit filter
@RequiredArgsConstructor
public class AuditFilter implements Filter {

    private final AuditLogger auditLogger;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        long startTime = System.currentTimeMillis();
        
        try {
            chain.doFilter(request, response);
        } finally {
            long responseTime = System.currentTimeMillis() - startTime;
            
            String userId = extractUserId(httpRequest);
            String ipAddress = extractIpAddress(httpRequest);
            String method = httpRequest.getMethod();
            String path = httpRequest.getRequestURI();
            int statusCode = httpResponse.getStatus();
            
            // Skip health and metrics endpoints
            if (!path.contains("/health") && !path.contains("/metrics") && !path.contains("/actuator")) {
                auditLogger.logApiRequest(userId, ipAddress, method, path, statusCode, responseTime);
            }
        }
    }

    private String extractUserId(HttpServletRequest request) {
        // Try to get from header
        String userId = request.getHeader("X-User-Id");
        if (userId != null && !userId.isEmpty()) {
            return userId;
        }
        
        // Try to get from attribute
        Object userIdAttr = request.getAttribute("userId");
        if (userIdAttr != null) {
            return userIdAttr.toString();
        }
        
        return "anonymous";
    }

    private String extractIpAddress(HttpServletRequest request) {
        // Check X-Forwarded-For header
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isEmpty()) {
            return forwarded.split(",")[0].trim();
        }
        
        // Check X-Real-IP header
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp;
        }
        
        return request.getRemoteAddr();
    }
}
