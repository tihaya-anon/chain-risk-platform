// Package audit provides structured audit logging for alert service
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
	EventAlertCreate       EventType = "ALERT_CREATE"
	EventAlertDelete       EventType = "ALERT_DELETE"
	EventAlertUpdate       EventType = "ALERT_UPDATE"
	EventAlertTriggered    EventType = "ALERT_TRIGGERED"
	EventRuleCreate        EventType = "RULE_CREATE"
	EventRuleDelete        EventType = "RULE_DELETE"
	EventRuleUpdate        EventType = "RULE_UPDATE"
	EventSubscriptionAdd   EventType = "SUBSCRIPTION_ADD"
	EventSubscriptionDel   EventType = "SUBSCRIPTION_DELETE"
	EventNotificationSent  EventType = "NOTIFICATION_SENT"
	EventConfigChange      EventType = "CONFIG_CHANGE"
	EventAPIRequest        EventType = "API_REQUEST"
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
}

// Logger provides audit logging functionality
type Logger struct {
	logger      *slog.Logger
	serviceName string
}

// Config holds audit logger configuration
type Config struct {
	ServiceName string
	Output      string
	Format      string
}

// DefaultConfig returns default audit logger configuration
func DefaultConfig() Config {
	return Config{
		ServiceName: "alert-service",
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

// LogRuleCreate logs alert rule creation
func (l *Logger) LogRuleCreate(userID, ipAddress, ruleID, ruleName string, status Status) {
	l.Log(Event{
		EventType: EventRuleCreate,
		UserID:    userID,
		IPAddress: ipAddress,
		Resource:  "/api/v1/alerts/rules/" + ruleID,
		Action:    ActionCreate,
		Status:    status,
		Metadata: map[string]any{
			"rule_id":   ruleID,
			"rule_name": ruleName,
		},
	})
}

// LogRuleDelete logs alert rule deletion
func (l *Logger) LogRuleDelete(userID, ipAddress, ruleID string, status Status) {
	l.Log(Event{
		EventType: EventRuleDelete,
		UserID:    userID,
		IPAddress: ipAddress,
		Resource:  "/api/v1/alerts/rules/" + ruleID,
		Action:    ActionDelete,
		Status:    status,
		Metadata: map[string]any{
			"rule_id": ruleID,
		},
	})
}

// LogRuleUpdate logs alert rule update
func (l *Logger) LogRuleUpdate(userID, ipAddress, ruleID string, changes map[string]any, status Status) {
	l.Log(Event{
		EventType: EventRuleUpdate,
		UserID:    userID,
		IPAddress: ipAddress,
		Resource:  "/api/v1/alerts/rules/" + ruleID,
		Action:    ActionUpdate,
		Status:    status,
		Metadata: map[string]any{
			"rule_id": ruleID,
			"changes": changes,
		},
	})
}

// LogAlertTriggered logs when an alert is triggered
func (l *Logger) LogAlertTriggered(ruleID, alertID, address string, riskScore float64, severity string) {
	l.Log(Event{
		EventType: EventAlertTriggered,
		UserID:    "system",
		IPAddress: "internal",
		Resource:  "/alerts/" + alertID,
		Action:    ActionCreate,
		Status:    StatusSuccess,
		Metadata: map[string]any{
			"rule_id":    ruleID,
			"alert_id":   alertID,
			"address":    address,
			"risk_score": riskScore,
			"severity":   severity,
		},
	})
}

// LogNotificationSent logs notification dispatch
func (l *Logger) LogNotificationSent(alertID, channel, destination string, status Status, errorMsg string) {
	metadata := map[string]any{
		"alert_id":    alertID,
		"channel":     channel,
		"destination": destination,
	}
	if errorMsg != "" {
		metadata["error"] = errorMsg
	}

	l.Log(Event{
		EventType: EventNotificationSent,
		UserID:    "system",
		IPAddress: "internal",
		Resource:  "/notifications/" + alertID,
		Action:    ActionCreate,
		Status:    status,
		Metadata:  metadata,
	})
}

// LogSubscriptionAdd logs subscription creation
func (l *Logger) LogSubscriptionAdd(userID, ipAddress, subID, channel string, status Status) {
	l.Log(Event{
		EventType: EventSubscriptionAdd,
		UserID:    userID,
		IPAddress: ipAddress,
		Resource:  "/api/v1/alerts/subscriptions/" + subID,
		Action:    ActionCreate,
		Status:    status,
		Metadata: map[string]any{
			"subscription_id": subID,
			"channel":         channel,
		},
	})
}

// LogSubscriptionDelete logs subscription deletion
func (l *Logger) LogSubscriptionDelete(userID, ipAddress, subID string, status Status) {
	l.Log(Event{
		EventType: EventSubscriptionDel,
		UserID:    userID,
		IPAddress: ipAddress,
		Resource:  "/api/v1/alerts/subscriptions/" + subID,
		Action:    ActionDelete,
		Status:    status,
		Metadata: map[string]any{
			"subscription_id": subID,
		},
	})
}
