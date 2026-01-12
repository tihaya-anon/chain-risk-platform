// Package audit provides audit logging middleware for Gin
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
				"user_agent":       c.Request.UserAgent(),
			},
		})
	}
}

// SensitiveEndpointMiddleware logs audit events only for sensitive endpoints
func SensitiveEndpointMiddleware(auditLog *Logger, sensitivePatterns []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Check if this is a sensitive endpoint
		isSensitive := false
		for _, pattern := range sensitivePatterns {
			if matchPath(path, pattern) {
				isSensitive = true
				break
			}
		}

		if !isSensitive {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()
		responseTime := time.Since(start).Milliseconds()

		// Extract user info
		userID := c.GetString("user_id")
		if userID == "" {
			userID = "anonymous"
		}

		// Determine status
		status := StatusSuccess
		statusCode := c.Writer.Status()
		if statusCode >= 400 {
			status = StatusFailure
		}

		// Determine action
		action := ActionRead
		switch c.Request.Method {
		case "POST":
			action = ActionCreate
		case "PUT", "PATCH":
			action = ActionUpdate
		case "DELETE":
			action = ActionDelete
		}

		auditLog.Log(Event{
			EventType:  EventAPIRequest,
			UserID:     userID,
			IPAddress:  c.ClientIP(),
			Resource:   path,
			Action:     action,
			Status:     status,
			StatusCode: statusCode,
			Metadata: map[string]any{
				"method":           c.Request.Method,
				"response_time_ms": responseTime,
				"sensitive":        true,
			},
		})
	}
}

// matchPath checks if a path matches a pattern
func matchPath(path, pattern string) bool {
	// Simple prefix match for now
	if len(pattern) > 0 && pattern[len(pattern)-1] == '*' {
		return len(path) >= len(pattern)-1 && path[:len(pattern)-1] == pattern[:len(pattern)-1]
	}
	return path == pattern
}
