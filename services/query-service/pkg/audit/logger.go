// Package audit provides structured audit logging for security events
package audit

import (
	"encoding/json"
	"log/slog"
	"os"
	"time"
)

// EventType represents types of auditable events
type EventType string

const (
	EventAddressQuery  EventType = "ADDRESS_QUERY"
	EventTransferQuery EventType = "TRANSFER_QUERY"
	EventCacheAccess   EventType = "CACHE_ACCESS"
	EventConfigChange  EventType = "CONFIG_CHANGE"
	EventAPIRequest    EventType = "API_REQUEST"
	EventAuthAttempt   EventType = "AUTH_ATTEMPT"
	EventRateLimited   EventType = "RATE_LIMITED"
)

// Action represents the action performed
type Action string

const (
	ActionRead   Action = "READ"
	ActionWrite  Action = "WRITE"
	ActionDelete Action = "DELETE"
	ActionCreate Action = "CREATE"
	ActionUpdate Action = "UPDATE"
)

// Status represents the outcome of an action
type Status string

const (
	StatusSuccess Status = "SUCCESS"
	StatusFailure Status = "FAILURE"
	StatusDenied  Status = "DENIED"
)

// Event represents a structured audit event
type Event struct {
	Timestamp   time.Time      `json:"timestamp"`
	EventType   EventType      `json:"event_type"`
	UserID      string         `json:"user_id"`
	IPAddress   string         `json:"ip_address"`
	Resource    string         `json:"resource"`
	Action      Action         `json:"action"`
	Status      Status         `json:"status"`
	StatusCode  int            `json:"status_code,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	ServiceName string         `json:"service_name"`
	TraceID     string         `json:"trace_id,omitempty"`
	SpanID      string         `json:"span_id,omitempty"`
}

// Logger provides audit logging functionality
type Logger struct {
	logger      *slog.Logger
	serviceName string
}

// Config holds audit logger configuration
type Config struct {
	ServiceName string
	Output      string // "stdout", "stderr", or file path
	Format      string // "json" or "text"
}

// DefaultConfig returns default audit logger configuration
func DefaultConfig(serviceName string) Config {
	return Config{
		ServiceName: serviceName,
		Output:      "stdout",
		Format:      "json",
	}
}

// NewLogger creates a new audit logger
func NewLogger(cfg Config) *Logger {
	var output *os.File
	switch cfg.Output {
	case "stderr":
		output = os.Stderr
	default:
		output = os.Stdout
	}

	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}

	var handler slog.Handler
	if cfg.Format == "text" {
		handler = slog.NewTextHandler(output, opts)
	} else {
		handler = slog.NewJSONHandler(output, opts)
	}

	return &Logger{
		logger:      slog.New(handler),
		serviceName: cfg.ServiceName,
	}
}

// Log records an audit event
func (l *Logger) Log(event Event) {
	event.Timestamp = time.Now().UTC()
	event.ServiceName = l.serviceName

	// Convert metadata to JSON for structured logging
	metadataJSON := "{}"
	if event.Metadata != nil {
		if b, err := json.Marshal(event.Metadata); err == nil {
			metadataJSON = string(b)
		}
	}

	l.logger.Info("AUDIT",
		slog.String("event_type", string(event.EventType)),
		slog.String("user_id", event.UserID),
		slog.String("ip_address", event.IPAddress),
		slog.String("resource", event.Resource),
		slog.String("action", string(event.Action)),
		slog.String("status", string(event.Status)),
		slog.Int("status_code", event.StatusCode),
		slog.String("service_name", l.serviceName),
		slog.String("trace_id", event.TraceID),
		slog.String("metadata", metadataJSON),
		slog.Time("timestamp", event.Timestamp),
	)
}

// LogAddressQuery logs an address query event
func (l *Logger) LogAddressQuery(userID, ipAddress, address string, status Status, statusCode int, responseTimeMs int64) {
	l.Log(Event{
		EventType:  EventAddressQuery,
		UserID:     userID,
		IPAddress:  ipAddress,
		Resource:   "/api/v1/addresses/" + address,
		Action:     ActionRead,
		Status:     status,
		StatusCode: statusCode,
		Metadata: map[string]any{
			"address":          address,
			"response_time_ms": responseTimeMs,
		},
	})
}

// LogTransferQuery logs a transfer query event
func (l *Logger) LogTransferQuery(userID, ipAddress, address string, status Status, statusCode int, count int, responseTimeMs int64) {
	l.Log(Event{
		EventType:  EventTransferQuery,
		UserID:     userID,
		IPAddress:  ipAddress,
		Resource:   "/api/v1/addresses/" + address + "/transfers",
		Action:     ActionRead,
		Status:     status,
		StatusCode: statusCode,
		Metadata: map[string]any{
			"address":          address,
			"transfer_count":   count,
			"response_time_ms": responseTimeMs,
		},
	})
}

// LogCacheAccess logs a cache access event
func (l *Logger) LogCacheAccess(userID, ipAddress, cacheKey string, hit bool, action Action) {
	status := StatusSuccess
	if !hit && action == ActionRead {
		status = StatusFailure
	}

	l.Log(Event{
		EventType: EventCacheAccess,
		UserID:    userID,
		IPAddress: ipAddress,
		Resource:  "cache:" + cacheKey,
		Action:    action,
		Status:    status,
		Metadata: map[string]any{
			"cache_hit": hit,
		},
	})
}

// LogRateLimited logs a rate limit event
func (l *Logger) LogRateLimited(ipAddress, resource string) {
	l.Log(Event{
		EventType:  EventRateLimited,
		UserID:     "anonymous",
		IPAddress:  ipAddress,
		Resource:   resource,
		Action:     ActionRead,
		Status:     StatusDenied,
		StatusCode: 429,
		Metadata: map[string]any{
			"reason": "rate_limit_exceeded",
		},
	})
}

// LogAPIRequest logs a generic API request
func (l *Logger) LogAPIRequest(userID, ipAddress, method, path string, statusCode int, responseTimeMs int64) {
	status := StatusSuccess
	if statusCode >= 400 {
		status = StatusFailure
	}

	action := ActionRead
	switch method {
	case "POST":
		action = ActionCreate
	case "PUT", "PATCH":
		action = ActionUpdate
	case "DELETE":
		action = ActionDelete
	}

	l.Log(Event{
		EventType:  EventAPIRequest,
		UserID:     userID,
		IPAddress:  ipAddress,
		Resource:   path,
		Action:     action,
		Status:     status,
		StatusCode: statusCode,
		Metadata: map[string]any{
			"method":           method,
			"response_time_ms": responseTimeMs,
		},
	})
}
