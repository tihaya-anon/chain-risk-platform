package notifier

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"go.uber.org/zap"
)

// EmailNotifier sends alerts via email
type EmailNotifier struct {
	smtpHost     string
	smtpPort     int
	smtpUser     string
	smtpPassword string
	from         string
	logger       *zap.Logger
}

// EmailConfig holds email notifier configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	From         string
}

// NewEmailNotifier creates a new email notifier
func NewEmailNotifier(cfg EmailConfig, logger *zap.Logger) *EmailNotifier {
	return &EmailNotifier{
		smtpHost:     cfg.SMTPHost,
		smtpPort:     cfg.SMTPPort,
		smtpUser:     cfg.SMTPUser,
		smtpPassword: cfg.SMTPPassword,
		from:         cfg.From,
		logger:       logger,
	}
}

// Type returns the channel type
func (n *EmailNotifier) Type() string {
	return model.ChannelTypeEmail
}

// Send sends an alert via email
func (n *EmailNotifier) Send(ctx context.Context, alert *model.Alert, config model.JSONB) error {
	// Parse config
	to, ok := config["email"].(string)
	if !ok || to == "" {
		return fmt.Errorf("missing email address in config")
	}

	// Build email
	subject := n.buildSubject(alert)
	body := n.buildBody(alert)

	msg := n.buildMessage(to, subject, body)

	// Send email
	addr := fmt.Sprintf("%s:%d", n.smtpHost, n.smtpPort)
	auth := smtp.PlainAuth("", n.smtpUser, n.smtpPassword, n.smtpHost)

	if err := smtp.SendMail(addr, auth, n.from, []string{to}, []byte(msg)); err != nil {
		return fmt.Errorf("send email: %w", err)
	}

	n.logger.Debug("Email notification sent",
		zap.String("to", to),
		zap.String("subject", subject))

	return nil
}

func (n *EmailNotifier) buildSubject(alert *model.Alert) string {
	severityPrefix := strings.ToUpper(alert.Severity)
	return fmt.Sprintf("[%s] Chain Risk Alert: %s", severityPrefix, alert.Title)
}

func (n *EmailNotifier) buildBody(alert *model.Alert) string {
	var sb strings.Builder

	sb.WriteString("Chain Risk Platform Alert\n")
	sb.WriteString("=" + strings.Repeat("=", 40) + "\n\n")

	sb.WriteString(fmt.Sprintf("Title: %s\n", alert.Title))
	sb.WriteString(fmt.Sprintf("Severity: %s\n", strings.ToUpper(alert.Severity)))
	sb.WriteString(fmt.Sprintf("Type: %s\n", alert.Type))
	sb.WriteString(fmt.Sprintf("Entity: %s (%s)\n", alert.EntityID, alert.EntityType))
	sb.WriteString("\n")

	sb.WriteString("Details:\n")
	sb.WriteString("-" + strings.Repeat("-", 40) + "\n")
	sb.WriteString(alert.Message)
	sb.WriteString("\n\n")

	if len(alert.Metadata) > 0 {
		sb.WriteString("Metadata:\n")
		for k, v := range alert.Metadata {
			sb.WriteString(fmt.Sprintf("  - %s: %v\n", k, v))
		}
	}

	sb.WriteString("\n")
	sb.WriteString("-" + strings.Repeat("-", 40) + "\n")
	sb.WriteString("This is an automated message from Chain Risk Platform.\n")

	return sb.String()
}

func (n *EmailNotifier) buildMessage(to, subject, body string) string {
	headers := make(map[string]string)
	headers["From"] = n.from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/plain; charset=UTF-8"

	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	return msg.String()
}
