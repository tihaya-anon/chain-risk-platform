package producer

import (
	"context"
	"time"

	"github.com/chain-risk-platform/mempool-collector/internal/collector"
	"github.com/chain-risk-platform/mempool-collector/internal/config"
	"github.com/chain-risk-platform/mempool-collector/internal/model"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.uber.org/zap"
)

// KafkaProducer publishes pending transactions to Kafka
type KafkaProducer struct {
	cfg      *config.KafkaConfig
	producer *kafka.Producer
	logger   *zap.Logger
	metrics  *collector.Metrics
}

// NewKafkaProducer creates a new Kafka producer
func NewKafkaProducer(cfg *config.KafkaConfig, logger *zap.Logger, metrics *collector.Metrics) (*KafkaProducer, error) {
	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers":   cfg.Brokers,
		"batch.size":          cfg.BatchSize,
		"linger.ms":           cfg.LingerMs,
		"compression.type":    cfg.CompressionType,
		"acks":                "1",
		"retries":             3,
		"retry.backoff.ms":    100,
		"socket.keepalive.enable": true,
	})
	if err != nil {
		return nil, err
	}

	p := &KafkaProducer{
		cfg:      cfg,
		producer: producer,
		logger:   logger,
		metrics:  metrics,
	}

	go p.handleDeliveryReports()

	return p, nil
}

// Produce sends a pending transaction to Kafka
func (p *KafkaProducer) Produce(ctx context.Context, tx *model.PendingTx) error {
	data, err := tx.ToJSON()
	if err != nil {
		return err
	}

	msg := &kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &p.cfg.Topic, Partition: kafka.PartitionAny},
		Key:            []byte(tx.Hash),
		Value:          data,
		Timestamp:      time.Now(),
	}

	err = p.producer.Produce(msg, nil)
	if err != nil {
		p.metrics.KafkaErrors.Inc()
		return err
	}

	return nil
}

// Flush waits for all messages to be delivered
func (p *KafkaProducer) Flush() {
	p.producer.Flush(int(p.cfg.FlushTimeout.Milliseconds()))
}

// Close shuts down the producer
func (p *KafkaProducer) Close() {
	p.Flush()
	p.producer.Close()
}

func (p *KafkaProducer) handleDeliveryReports() {
	for e := range p.producer.Events() {
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				p.metrics.KafkaErrors.Inc()
				p.logger.Error("Delivery failed",
					zap.String("topic", *ev.TopicPartition.Topic),
					zap.Error(ev.TopicPartition.Error))
			} else {
				p.metrics.KafkaProduced.Inc()
			}
		}
	}
}
