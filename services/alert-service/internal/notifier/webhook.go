package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"go.uber.org/zap"
)

// WebhookNotifier sends alerts via HTTP webhook
type WebhookNotifier struct {
	client *http.Client
	logger *zap.Logger
}

// NewWebhookNotifier creates a new webhook notifier
func NewWebhookNotifier(timeout time.Duration, logger *zap.Logger) *WebhookNotifier {
	return &WebhookNotifier{
		client: &http.Client{
			Timeout: timeout,
		},
		logger: logger,
	}
}

// Type returns the channel type
func (n *WebhookNotifier) Type() string {
	return model.ChannelTypeWebhook
}

// WebhookPayload represents the payload sent to webhooks
type WebhookPayload struct {
	AlertID    *int64         `json:"alert_id,omitempty"`
	Type       string         `json:"type"`
	Severity   string         `json:"severity"`
	EntityType string         `json:"entity_type"`
	EntityID   string         `json:"entity_id"`
	Title      string         `json:"title"`
	Message    string         `json:"message"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	Timestamp  time.Time      `json:"timestamp"`
}

// Send sends an alert via webhook
func (n *WebhookNotifier) Send(ctx context.Context, alert *model.Alert, config model.JSONB) error {
	// Parse config
	url, ok := config["url"].(string)
	if !ok || url == "" {
		return fmt.Errorf("missing webhook url in config")
	}

	// Build payload
	payload := WebhookPayload{
		AlertID:    alert.RuleID,
		Type:       alert.Type,
		Severity:   alert.Severity,
		EntityType: alert.EntityType,
		EntityID:   alert.EntityID,
		Title:      alert.Title,
		Message:    alert.Message,
		Metadata:   alert.Metadata,
		Timestamp:  time.Now().UTC(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Add custom headers
	if headers, ok := config["headers"].(map[string]any); ok {
		for k, v := range headers {
			if s, ok := v.(string); ok {
				req.Header.Set(k, s)
			}
		}
	}

	// Send request
	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	n.logger.Debug("Webhook notification sent",
		zap.String("url", url),
		zap.String("alert_type", alert.Type),
		zap.Int("status", resp.StatusCode))

	return nil
}
