package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// EventHandler processes Kafka events
type EventHandler interface {
	HandleRiskScoreEvent(ctx context.Context, event model.RiskScoreEvent) error
	HandleTransferEvent(ctx context.Context, event model.TransferEvent) error
	HandleMevAlertEvent(ctx context.Context, event model.MevAlertEvent) error
}

// Consumer wraps Kafka consumer with graceful shutdown
type Consumer struct {
	readers map[string]*kafka.Reader
	handler EventHandler
	logger  *zap.Logger
	done    chan struct{}
}

// Config holds Kafka consumer configuration
type Config struct {
	Brokers           []string
	GroupID           string
	RiskScoresTopic   string
	TransfersTopic    string
	MevAlertsTopic    string
	SessionTimeout    time.Duration
	HeartbeatInterval time.Duration
}

// NewConsumer creates a new Kafka consumer
func NewConsumer(cfg Config, handler EventHandler, logger *zap.Logger) *Consumer {
	readers := make(map[string]*kafka.Reader)

	// Risk scores reader
	if cfg.RiskScoresTopic != "" {
		readers[cfg.RiskScoresTopic] = kafka.NewReader(kafka.ReaderConfig{
			Brokers:           cfg.Brokers,
			GroupID:           cfg.GroupID,
			Topic:             cfg.RiskScoresTopic,
			MinBytes:          1,
			MaxBytes:          10e6,
			MaxWait:           500 * time.Millisecond,
			SessionTimeout:    cfg.SessionTimeout,
			HeartbeatInterval: cfg.HeartbeatInterval,
			StartOffset:       kafka.LastOffset,
		})
	}

	// Transfers reader
	if cfg.TransfersTopic != "" {
		readers[cfg.TransfersTopic] = kafka.NewReader(kafka.ReaderConfig{
			Brokers:           cfg.Brokers,
			GroupID:           cfg.GroupID,
			Topic:             cfg.TransfersTopic,
			MinBytes:          1,
			MaxBytes:          10e6,
			MaxWait:           500 * time.Millisecond,
			SessionTimeout:    cfg.SessionTimeout,
			HeartbeatInterval: cfg.HeartbeatInterval,
			StartOffset:       kafka.LastOffset,
		})
	}

	// MEV alerts reader
	if cfg.MevAlertsTopic != "" {
		readers[cfg.MevAlertsTopic] = kafka.NewReader(kafka.ReaderConfig{
			Brokers:           cfg.Brokers,
			GroupID:           cfg.GroupID,
			Topic:             cfg.MevAlertsTopic,
			MinBytes:          1,
			MaxBytes:          10e6,
			MaxWait:           500 * time.Millisecond,
			SessionTimeout:    cfg.SessionTimeout,
			HeartbeatInterval: cfg.HeartbeatInterval,
			StartOffset:       kafka.LastOffset,
		})
	}

	return &Consumer{
		readers: readers,
		handler: handler,
		logger:  logger,
		done:    make(chan struct{}),
	}
}

// Start begins consuming messages from all topics
func (c *Consumer) Start(ctx context.Context) error {
	for topic, reader := range c.readers {
		go c.consumeTopic(ctx, topic, reader)
	}

	c.logger.Info("Kafka consumer started",
		zap.Int("topics", len(c.readers)))

	<-ctx.Done()
	return ctx.Err()
}

// consumeTopic consumes messages from a single topic
func (c *Consumer) consumeTopic(ctx context.Context, topic string, reader *kafka.Reader) {
	c.logger.Info("Starting consumer for topic", zap.String("topic", topic))

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.done:
			return
		default:
			msg, err := reader.FetchMessage(ctx)
			if err != nil {
				if err == io.EOF || err == context.Canceled {
					return
				}
				c.logger.Error("Failed to fetch message",
					zap.String("topic", topic),
					zap.Error(err))
				continue
			}

			if err := c.processMessage(ctx, topic, msg); err != nil {
				c.logger.Error("Failed to process message",
					zap.String("topic", topic),
					zap.Int64("offset", msg.Offset),
					zap.Error(err))
			}

			if err := reader.CommitMessages(ctx, msg); err != nil {
				c.logger.Error("Failed to commit message",
					zap.String("topic", topic),
					zap.Int64("offset", msg.Offset),
					zap.Error(err))
			}
		}
	}
}

// processMessage routes message to appropriate handler
func (c *Consumer) processMessage(ctx context.Context, topic string, msg kafka.Message) error {
	switch {
	case c.isRiskScoresTopic(topic):
		return c.handleRiskScoreMessage(ctx, msg)
	case c.isTransfersTopic(topic):
		return c.handleTransferMessage(ctx, msg)
	case c.isMevAlertsTopic(topic):
		return c.handleMevAlertMessage(ctx, msg)
	default:
		return fmt.Errorf("unknown topic: %s", topic)
	}
}

func (c *Consumer) isRiskScoresTopic(topic string) bool {
	return topic == "risk-scores" || topic == "risk_scores"
}

func (c *Consumer) isTransfersTopic(topic string) bool {
	return topic == "transfers"
}

func (c *Consumer) isMevAlertsTopic(topic string) bool {
	return topic == "mev-alerts" || topic == "mev_alerts"
}

func (c *Consumer) handleRiskScoreMessage(ctx context.Context, msg kafka.Message) error {
	var event model.RiskScoreEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		return fmt.Errorf("unmarshal risk score event: %w", err)
	}

	c.logger.Debug("Received risk score event",
		zap.String("address", event.Address),
		zap.Float64("score", event.Score))

	return c.handler.HandleRiskScoreEvent(ctx, event)
}

func (c *Consumer) handleTransferMessage(ctx context.Context, msg kafka.Message) error {
	var event model.TransferEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		return fmt.Errorf("unmarshal transfer event: %w", err)
	}

	c.logger.Debug("Received transfer event",
		zap.String("tx_hash", event.TxHash),
		zap.Float64("value_usd", event.ValueUSD))

	return c.handler.HandleTransferEvent(ctx, event)
}

func (c *Consumer) handleMevAlertMessage(ctx context.Context, msg kafka.Message) error {
	var event model.MevAlertEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		return fmt.Errorf("unmarshal mev alert event: %w", err)
	}

	c.logger.Debug("Received MEV alert event",
		zap.String("alert_id", event.AlertID),
		zap.String("alert_type", event.AlertType),
		zap.String("attacker", event.AttackerAddress))

	return c.handler.HandleMevAlertEvent(ctx, event)
}

// Stop gracefully stops the consumer
func (c *Consumer) Stop() error {
	close(c.done)

	var lastErr error
	for topic, reader := range c.readers {
		if err := reader.Close(); err != nil {
			c.logger.Error("Failed to close reader",
				zap.String("topic", topic),
				zap.Error(err))
			lastErr = err
		}
	}

	c.logger.Info("Kafka consumer stopped")
	return lastErr
}
