package notifier

import (
	"context"
	"fmt"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"go.uber.org/zap"
)

// Dispatcher manages notification delivery with retry support
type Dispatcher struct {
	registry      *NotifierRegistry
	retryAttempts int
	retryDelay    time.Duration
	logger        *zap.Logger
}

// NewDispatcher creates a new notification dispatcher
func NewDispatcher(
	registry *NotifierRegistry,
	retryAttempts int,
	retryDelay time.Duration,
	logger *zap.Logger,
) *Dispatcher {
	return &Dispatcher{
		registry:      registry,
		retryAttempts: retryAttempts,
		retryDelay:    retryDelay,
		logger:        logger,
	}
}

// Send sends an alert via a subscription channel with retry
func (d *Dispatcher) Send(ctx context.Context, alert *model.Alert, sub *model.AlertSubscription) error {
	if !sub.Enabled {
		return nil
	}

	notifier, ok := d.registry.Get(sub.ChannelType)
	if !ok {
		return fmt.Errorf("unknown channel type: %s", sub.ChannelType)
	}

	var lastErr error
	for attempt := 1; attempt <= d.retryAttempts; attempt++ {
		err := notifier.Send(ctx, alert, sub.ChannelConfig)
		if err == nil {
			d.logger.Info("Notification sent successfully",
				zap.String("channel", sub.ChannelType),
				zap.String("alert_type", alert.Type),
				zap.Int("attempt", attempt))
			return nil
		}

		lastErr = err
		d.logger.Warn("Notification failed, retrying",
			zap.String("channel", sub.ChannelType),
			zap.Int("attempt", attempt),
			zap.Int("max_attempts", d.retryAttempts),
			zap.Error(err))

		if attempt < d.retryAttempts {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(d.retryDelay):
			}
		}
	}

	d.logger.Error("All notification attempts failed",
		zap.String("channel", sub.ChannelType),
		zap.String("alert_type", alert.Type),
		zap.Error(lastErr))

	return fmt.Errorf("all %d retry attempts failed: %w", d.retryAttempts, lastErr)
}

// SendAll sends an alert to all subscriptions
func (d *Dispatcher) SendAll(ctx context.Context, alert *model.Alert, subs []*model.AlertSubscription) []error {
	var errors []error

	for _, sub := range subs {
		if err := d.Send(ctx, alert, sub); err != nil {
			errors = append(errors, fmt.Errorf("subscription %d: %w", sub.ID, err))
		}
	}

	return errors
}

// SendDirect sends an alert directly to a channel without subscription
func (d *Dispatcher) SendDirect(ctx context.Context, alert *model.Alert, channelType string, config model.JSONB) error {
	notifier, ok := d.registry.Get(channelType)
	if !ok {
		return fmt.Errorf("unknown channel type: %s", channelType)
	}

	var lastErr error
	for attempt := 1; attempt <= d.retryAttempts; attempt++ {
		err := notifier.Send(ctx, alert, config)
		if err == nil {
			return nil
		}

		lastErr = err
		if attempt < d.retryAttempts {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(d.retryDelay):
			}
		}
	}

	return fmt.Errorf("all retry attempts failed: %w", lastErr)
}

// GetRegistry returns the notifier registry
func (d *Dispatcher) GetRegistry() *NotifierRegistry {
	return d.registry
}
