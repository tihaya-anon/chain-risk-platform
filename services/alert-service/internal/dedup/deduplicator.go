package dedup

import (
	"context"
	"fmt"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Deduplicator handles alert deduplication using Redis
type Deduplicator struct {
	redis  *redis.Client
	window time.Duration
	logger *zap.Logger
}

// NewDeduplicator creates a new deduplicator
func NewDeduplicator(redisClient *redis.Client, window time.Duration, logger *zap.Logger) *Deduplicator {
	return &Deduplicator{
		redis:  redisClient,
		window: window,
		logger: logger,
	}
}

// IsDuplicate checks if an alert was recently sent
func (d *Deduplicator) IsDuplicate(ctx context.Context, alert *model.Alert) (bool, error) {
	key := d.buildKey(alert)
	exists, err := d.redis.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("check duplicate: %w", err)
	}
	return exists > 0, nil
}

// MarkSent marks an alert as sent
func (d *Deduplicator) MarkSent(ctx context.Context, alert *model.Alert) error {
	key := d.buildKey(alert)
	if err := d.redis.Set(ctx, key, "1", d.window).Err(); err != nil {
		return fmt.Errorf("mark sent: %w", err)
	}
	return nil
}

// Filter removes duplicate alerts from the list
func (d *Deduplicator) Filter(ctx context.Context, alerts []*model.Alert) ([]*model.Alert, error) {
	if len(alerts) == 0 {
		return alerts, nil
	}

	var filtered []*model.Alert
	for _, alert := range alerts {
		isDup, err := d.IsDuplicate(ctx, alert)
		if err != nil {
			d.logger.Warn("Dedup check failed, including alert",
				zap.String("entity_id", alert.EntityID),
				zap.Error(err))
			filtered = append(filtered, alert)
			continue
		}

		if !isDup {
			filtered = append(filtered, alert)
		} else {
			d.logger.Debug("Filtered duplicate alert",
				zap.String("type", alert.Type),
				zap.String("entity_id", alert.EntityID))
		}
	}

	return filtered, nil
}

// buildKey creates a unique key for deduplication
func (d *Deduplicator) buildKey(alert *model.Alert) string {
	// Key format: alert:dedup:{type}:{entity_type}:{entity_id}
	return fmt.Sprintf("alert:dedup:%s:%s:%s",
		alert.Type, alert.EntityType, alert.EntityID)
}

// GetWindow returns the deduplication window
func (d *Deduplicator) GetWindow() time.Duration {
	return d.window
}

// Clear removes a dedup entry (useful for testing)
func (d *Deduplicator) Clear(ctx context.Context, alert *model.Alert) error {
	key := d.buildKey(alert)
	return d.redis.Del(ctx, key).Err()
}
