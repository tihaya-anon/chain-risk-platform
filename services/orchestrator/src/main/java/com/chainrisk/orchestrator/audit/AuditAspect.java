package com.chainrisk.orchestrator.audit;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.HashMap;
import java.util.Map;

/**
 * AOP aspect for automatic audit logging of annotated methods
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditLogger auditLogger;

    @Around("@annotation(audited)")
    public Object auditMethod(ProceedingJoinPoint joinPoint, Audited audited) throws Throwable {
        long startTime = System.currentTimeMillis();
        
        // Get request context
        HttpServletRequest request = getCurrentRequest();
        String userId = extractUserId(request);
        String ipAddress = extractIpAddress(request);
        String resource = buildResource(audited.resource(), request);
        
        AuditLogger.Status status = AuditLogger.Status.SUCCESS;
        Integer statusCode = 200;
        Object result = null;
        Exception exception = null;

        try {
            result = joinPoint.proceed();
            return result;
        } catch (Exception e) {
            status = AuditLogger.Status.FAILURE;
            statusCode = 500;
            exception = e;
            throw e;
        } finally {
            long responseTime = System.currentTimeMillis() - startTime;
            
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("method", joinPoint.getSignature().getName());
            metadata.put("response_time_ms", responseTime);
            
            if (exception != null) {
                metadata.put("error", exception.getMessage());
            }
            
            auditLogger.log(AuditLogger.AuditEvent.builder()
                    .eventType(audited.eventType())
                    .userId(userId)
                    .ipAddress(ipAddress)
                    .resource(resource)
                    .action(audited.action())
                    .status(status)
                    .statusCode(statusCode)
                    .metadata(metadata)
                    .build());
        }
    }

    private HttpServletRequest getCurrentRequest() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs != null ? attrs.getRequest() : null;
    }

    private String extractUserId(HttpServletRequest request) {
        if (request == null) return "anonymous";
        
        // Try to get from header
        String userId = request.getHeader("X-User-Id");
        if (userId != null && !userId.isEmpty()) {
            return userId;
        }
        
        // Try to get from attribute (set by auth filter)
        Object userIdAttr = request.getAttribute("userId");
        if (userIdAttr != null) {
            return userIdAttr.toString();
        }
        
        return "anonymous";
    }

    private String extractIpAddress(HttpServletRequest request) {
        if (request == null) return "unknown";
        
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

    private String buildResource(String pattern, HttpServletRequest request) {
        if (pattern == null || pattern.isEmpty()) {
            return request != null ? request.getRequestURI() : "unknown";
        }
        return pattern;
    }
}
