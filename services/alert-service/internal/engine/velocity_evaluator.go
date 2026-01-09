package engine

import (
	"context"
	"fmt"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// VelocityEvaluator evaluates transaction velocity rules
type VelocityEvaluator struct {
	redis  *redis.Client
	logger *zap.Logger
}

// NewVelocityEvaluator creates a new velocity evaluator
func NewVelocityEvaluator(redisClient *redis.Client, logger *zap.Logger) *VelocityEvaluator {
	return &VelocityEvaluator{
		redis:  redisClient,
		logger: logger,
	}
}

// RuleType returns the rule type
func (e *VelocityEvaluator) RuleType() string {
	return model.RuleTypeVelocity
}

// Evaluate checks if the event matches the rule conditions
func (e *VelocityEvaluator) Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error) {
	// Only process transfer events
	if event.Type != model.EventTypeTransfer {
		return &EvaluationResult{Matched: false}, nil
	}

	// Parse conditions
	conditions, err := e.parseConditions(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("parse conditions: %w", err)
	}

	// Get addresses from event
	fromAddress := event.GetString("from_address")
	toAddress := event.GetString("to_address")

	// Check velocity for both addresses
	for _, address := range []string{fromAddress, toAddress} {
		if address == "" {
			continue
		}

		count, err := e.incrementCounter(ctx, address, conditions.Window)
		if err != nil {
			e.logger.Warn("Failed to increment velocity counter", 
				zap.String("address", address),
				zap.Error(err))
			continue
		}

		if count >= int64(conditions.Count) {
			alert := e.createAlert(event, rule, address, count, conditions)
			return &EvaluationResult{Matched: true, Alert: alert}, nil
		}
	}

	return &EvaluationResult{Matched: false}, nil
}

func (e *VelocityEvaluator) parseConditions(cond model.JSONB) (*model.VelocityConditions, error) {
	conditions := &model.VelocityConditions{
		Window: "1h", // default 1 hour
	}

	if v, ok := cond["count"].(float64); ok {
		conditions.Count = int(v)
	} else {
		return nil, fmt.Errorf("missing or invalid count")
	}

	if v, ok := cond["window"].(string); ok {
		conditions.Window = v
	}

	return conditions, nil
}

func (e *VelocityEvaluator) incrementCounter(ctx context.Context, address, window string) (int64, error) {
	key := fmt.Sprintf("alert:velocity:%s", address)
	windowDuration := e.parseWindow(window)

	pipe := e.redis.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, windowDuration)
	_, err := pipe.Exec(ctx)

	if err != nil {
		return 0, err
	}

	return incr.Val(), nil
}

func (e *VelocityEvaluator) parseWindow(window string) time.Duration {
	duration, err := time.ParseDuration(window)
	if err != nil {
		// Try parsing common formats
		switch window {
		case "1m", "1min":
			return time.Minute
		case "5m", "5min":
			return 5 * time.Minute
		case "15m", "15min":
			return 15 * time.Minute
		case "1h", "1hour":
			return time.Hour
		case "1d", "1day":
			return 24 * time.Hour
		default:
			return time.Hour // default to 1 hour
		}
	}
	return duration
}

func (e *VelocityEvaluator) createAlert(event model.Event, rule *model.AlertRule, address string, count int64, conditions *model.VelocityConditions) *model.Alert {
	return &model.Alert{
		RuleID:     &rule.ID,
		Type:       model.RuleTypeVelocity,
		Severity:   rule.Severity,
		EntityType: model.EntityTypeAddress,
		EntityID:   address,
		Title:      fmt.Sprintf("High transaction velocity: %d transactions", count),
		Message:    e.buildMessage(address, count, conditions),
		Metadata: map[string]interface{}{
			"address":     address,
			"count":       count,
			"threshold":   conditions.Count,
			"window":      conditions.Window,
			"last_tx":     event.GetString("tx_hash"),
		},
	}
}

func (e *VelocityEvaluator) buildMessage(address string, count int64, conditions *model.VelocityConditions) string {
	return fmt.Sprintf("Address %s has %d transactions in the last %s (threshold: %d)",
		address, count, conditions.Window, conditions.Count)
}

// GetCurrentCount returns the current transaction count for an address
func (e *VelocityEvaluator) GetCurrentCount(ctx context.Context, address string) (int64, error) {
	key := fmt.Sprintf("alert:velocity:%s", address)
	count, err := e.redis.Get(ctx, key).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return count, err
}

// ResetCounter resets the velocity counter for an address
func (e *VelocityEvaluator) ResetCounter(ctx context.Context, address string) error {
	key := fmt.Sprintf("alert:velocity:%s", address)
	return e.redis.Del(ctx, key).Err()
}
