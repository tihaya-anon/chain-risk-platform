package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a custom type for PostgreSQL JSONB columns
type JSONB map[string]any

// Value implements the driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface
func (j *JSONB) Scan(value any) error {
	if value == nil {
		*j = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to unmarshal JSONB value: %v", value)
	}

	return json.Unmarshal(bytes, j)
}

// AlertRule represents an alert rule definition
type AlertRule struct {
	ID          int64     `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	RuleType    string    `json:"rule_type" db:"rule_type"`
	Conditions  JSONB     `json:"conditions" db:"conditions"`
	Severity    string    `json:"severity" db:"severity"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// AlertHistory represents a triggered alert record
type AlertHistory struct {
	ID             int64      `json:"id" db:"id"`
	RuleID         *int64     `json:"rule_id" db:"rule_id"`
	AlertType      string     `json:"alert_type" db:"alert_type"`
	Severity       string     `json:"severity" db:"severity"`
	EntityType     string     `json:"entity_type" db:"entity_type"`
	EntityID       string     `json:"entity_id" db:"entity_id"`
	Title          string     `json:"title" db:"title"`
	Message        string     `json:"message" db:"message"`
	Metadata       JSONB      `json:"metadata" db:"metadata"`
	Status         string     `json:"status" db:"status"`
	NotifiedAt     *time.Time `json:"notified_at" db:"notified_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at" db:"acknowledged_at"`
	AcknowledgedBy *string    `json:"acknowledged_by" db:"acknowledged_by"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

// AlertSubscription represents a user's subscription to an alert rule
type AlertSubscription struct {
	ID            int64     `json:"id" db:"id"`
	UserID        string    `json:"user_id" db:"user_id"`
	RuleID        *int64    `json:"rule_id" db:"rule_id"` // Nullable for global subscriptions
	ChannelType   string    `json:"channel_type" db:"channel_type"`
	ChannelConfig JSONB     `json:"channel_config" db:"channel_config"`
	Enabled       bool      `json:"enabled" db:"enabled"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// Alert represents an alert to be sent
type Alert struct {
	RuleID     *int64
	Type       string
	Severity   string
	EntityType string
	EntityID   string
	Title      string
	Message    string
	Metadata   map[string]any
}

// RuleType constants
const (
	RuleTypeRiskScore        = "risk_score"
	RuleTypeTransactionValue = "transaction_value"
	RuleTypeTagMatch         = "tag_match"
	RuleTypeGraphPattern     = "graph_pattern"
	RuleTypeVelocity         = "velocity"
	RuleTypeClusterRisk      = "cluster_risk"
)

// Severity constants
const (
	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)

// AlertStatus constants
const (
	AlertStatusPending      = "pending"
	AlertStatusSent         = "sent"
	AlertStatusFailed       = "failed"
	AlertStatusAcknowledged = "acknowledged"
)

// ChannelType constants
const (
	ChannelTypeEmail    = "email"
	ChannelTypeWebhook  = "webhook"
	ChannelTypeSlack    = "slack"
	ChannelTypeTelegram = "telegram"
)

// EntityType constants
const (
	EntityTypeAddress     = "address"
	EntityTypeTransaction = "transaction"
	EntityTypeCluster     = "cluster"
)

// RiskScoreConditions represents conditions for risk_score rule type
type RiskScoreConditions struct {
	Threshold float64 `json:"threshold"`
	Operator  string  `json:"operator"` // ">=", ">", "<=", "<", "=="
	Window    string  `json:"window"`   // e.g., "5m", "1h"
}

// TransactionValueConditions represents conditions for transaction_value rule type
type TransactionValueConditions struct {
	Threshold float64 `json:"threshold"`
	Operator  string  `json:"operator"`
	Currency  string  `json:"currency"` // "USD", "ETH", etc.
}

// TagMatchConditions represents conditions for tag_match rule type
type TagMatchConditions struct {
	Tags      []string `json:"tags"`
	MatchType string   `json:"match_type"` // "any", "all"
}

// VelocityConditions represents conditions for velocity rule type
type VelocityConditions struct {
	Count  int    `json:"count"`
	Window string `json:"window"` // e.g., "1h", "1d"
}

// EmailChannelConfig represents email channel configuration
type EmailChannelConfig struct {
	Email string `json:"email"`
}

// WebhookChannelConfig represents webhook channel configuration
type WebhookChannelConfig struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

// SlackChannelConfig represents Slack channel configuration
type SlackChannelConfig struct {
	WebhookURL string `json:"webhook_url"`
}
