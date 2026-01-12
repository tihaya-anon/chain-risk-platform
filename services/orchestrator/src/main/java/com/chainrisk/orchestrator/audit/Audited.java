package com.chainrisk.orchestrator.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to mark methods that should be audited
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /**
     * The event type for this audit
     */
    AuditLogger.EventType eventType() default AuditLogger.EventType.API_REQUEST;
    
    /**
     * The action being performed
     */
    AuditLogger.Action action() default AuditLogger.Action.READ;
    
    /**
     * Resource path pattern (can include placeholders)
     */
    String resource() default "";
    
    /**
     * Whether to include request body in metadata
     */
    boolean includeRequestBody() default false;
    
    /**
     * Whether to include response in metadata
     */
    boolean includeResponse() default false;
}
