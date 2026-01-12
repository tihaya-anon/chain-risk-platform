// Package audit provides audit logging middleware for alert service
package audit

import (
	"time"

	"github.com/gin-gonic/gin"
)

// Middleware returns a Gin middleware for audit logging
func Middleware(auditLog *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Calculate response time
		responseTime := time.Since(start).Milliseconds()

		// Extract user info
		userID := c.GetString("user_id")
		if userID == "" {
			userID = c.GetHeader("X-User-Id")
		}
		if userID == "" {
			userID = "anonymous"
		}

		// Extract trace ID
		traceID := c.GetHeader("X-Trace-Id")
		if traceID == "" {
			traceID = c.GetHeader("X-Request-Id")
		}

		// Determine status
		status := StatusSuccess
		statusCode := c.Writer.Status()
		if statusCode >= 400 {
			status = StatusFailure
		}

		// Determine action based on HTTP method
		action := ActionRead
		switch c.Request.Method {
		case "POST":
			action = ActionCreate
		case "PUT", "PATCH":
			action = ActionUpdate
		case "DELETE":
			action = ActionDelete
		}

		// Log the event
		auditLog.Log(Event{
			EventType:  EventAPIRequest,
			UserID:     userID,
			IPAddress:  c.ClientIP(),
			Resource:   c.Request.URL.Path,
			Action:     action,
			Status:     status,
			StatusCode: statusCode,
			TraceID:    traceID,
			Metadata: map[string]any{
				"method":           c.Request.Method,
				"query":            c.Request.URL.RawQuery,
				"response_time_ms": responseTime,
			},
		})
	}
}

// AlertOperationMiddleware logs audit events for alert-specific operations
func AlertOperationMiddleware(auditLog *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		responseTime := time.Since(start).Milliseconds()
		path := c.Request.URL.Path
		method := c.Request.Method
		statusCode := c.Writer.Status()

		// Determine event type based on path and method
		var eventType EventType
		switch {
		case contains(path, "/rules") && method == "POST":
			eventType = EventRuleCreate
		case contains(path, "/rules") && method == "DELETE":
			eventType = EventRuleDelete
		case contains(path, "/rules") && (method == "PUT" || method == "PATCH"):
			eventType = EventRuleUpdate
		case contains(path, "/subscriptions") && method == "POST":
			eventType = EventSubscriptionAdd
		case contains(path, "/subscriptions") && method == "DELETE":
			eventType = EventSubscriptionDel
		default:
			eventType = EventAPIRequest
		}

		// Extract user info
		userID := c.GetString("user_id")
		if userID == "" {
			userID = c.GetHeader("X-User-Id")
		}
		if userID == "" {
			userID = "anonymous"
		}

		// Determine status
		status := StatusSuccess
		if statusCode >= 400 {
			status = StatusFailure
		}

		// Determine action
		action := ActionRead
		switch method {
		case "POST":
			action = ActionCreate
		case "PUT", "PATCH":
			action = ActionUpdate
		case "DELETE":
			action = ActionDelete
		}

		auditLog.Log(Event{
			EventType:  eventType,
			UserID:     userID,
			IPAddress:  c.ClientIP(),
			Resource:   path,
			Action:     action,
			Status:     status,
			StatusCode: statusCode,
			Metadata: map[string]any{
				"method":           method,
				"response_time_ms": responseTime,
			},
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
