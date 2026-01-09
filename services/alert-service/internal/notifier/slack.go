package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"go.uber.org/zap"
)

// SlackNotifier sends alerts via Slack webhook
type SlackNotifier struct {
	client *http.Client
	logger *zap.Logger
}

// NewSlackNotifier creates a new Slack notifier
func NewSlackNotifier(timeout time.Duration, logger *zap.Logger) *SlackNotifier {
	return &SlackNotifier{
		client: &http.Client{
			Timeout: timeout,
		},
		logger: logger,
	}
}

// Type returns the channel type
func (n *SlackNotifier) Type() string {
	return model.ChannelTypeSlack
}

// SlackMessage represents a Slack message
type SlackMessage struct {
	Text        string       `json:"text,omitempty"`
	Blocks      []SlackBlock `json:"blocks,omitempty"`
	Attachments []SlackAttachment `json:"attachments,omitempty"`
}

// SlackBlock represents a Slack block
type SlackBlock struct {
	Type     string     `json:"type"`
	Text     *SlackText `json:"text,omitempty"`
	Fields   []SlackText `json:"fields,omitempty"`
	Elements []SlackElement `json:"elements,omitempty"`
}

// SlackText represents Slack text content
type SlackText struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Emoji bool   `json:"emoji,omitempty"`
}

// SlackElement represents a Slack element
type SlackElement struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// SlackAttachment represents a Slack attachment
type SlackAttachment struct {
	Color  string `json:"color"`
	Text   string `json:"text,omitempty"`
}

// Send sends an alert via Slack webhook
func (n *SlackNotifier) Send(ctx context.Context, alert *model.Alert, config model.JSONB) error {
	// Parse config
	webhookURL, ok := config["webhook_url"].(string)
	if !ok || webhookURL == "" {
		return fmt.Errorf("missing webhook_url in config")
	}

	// Build Slack message
	msg := n.buildMessage(alert)

	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("slack returned status %d", resp.StatusCode)
	}

	n.logger.Debug("Slack notification sent",
		zap.String("alert_type", alert.Type),
		zap.String("severity", alert.Severity))

	return nil
}

func (n *SlackNotifier) buildMessage(alert *model.Alert) SlackMessage {
	emoji := n.severityEmoji(alert.Severity)
	color := n.severityColor(alert.Severity)

	blocks := []SlackBlock{
		{
			Type: "header",
			Text: &SlackText{
				Type:  "plain_text",
				Text:  fmt.Sprintf("%s %s", emoji, alert.Title),
				Emoji: true,
			},
		},
		{
			Type: "section",
			Text: &SlackText{
				Type: "mrkdwn",
				Text: alert.Message,
			},
		},
		{
			Type: "section",
			Fields: []SlackText{
				{Type: "mrkdwn", Text: fmt.Sprintf("*Severity:*\n%s %s", emoji, strings.ToUpper(alert.Severity))},
				{Type: "mrkdwn", Text: fmt.Sprintf("*Type:*\n%s", alert.Type)},
				{Type: "mrkdwn", Text: fmt.Sprintf("*Entity:*\n%s", alert.EntityType)},
				{Type: "mrkdwn", Text: fmt.Sprintf("*ID:*\n`%s`", n.truncateID(alert.EntityID))},
			},
		},
		{
			Type: "divider",
		},
		{
			Type: "context",
			Elements: []SlackElement{
				{Type: "mrkdwn", Text: fmt.Sprintf("Alert from *Chain Risk Platform* | %s", time.Now().UTC().Format(time.RFC3339))},
			},
		},
	}

	return SlackMessage{
		Blocks: blocks,
		Attachments: []SlackAttachment{
			{Color: color},
		},
	}
}

func (n *SlackNotifier) severityEmoji(severity string) string {
	switch severity {
	case model.SeverityCritical:
		return "🔴"
	case model.SeverityHigh:
		return "🟠"
	case model.SeverityMedium:
		return "🟡"
	default:
		return "🟢"
	}
}

func (n *SlackNotifier) severityColor(severity string) string {
	switch severity {
	case model.SeverityCritical:
		return "#FF0000"
	case model.SeverityHigh:
		return "#FF8C00"
	case model.SeverityMedium:
		return "#FFD700"
	default:
		return "#32CD32"
	}
}

func (n *SlackNotifier) truncateID(id string) string {
	if len(id) > 20 {
		return id[:10] + "..." + id[len(id)-7:]
	}
	return id
}
