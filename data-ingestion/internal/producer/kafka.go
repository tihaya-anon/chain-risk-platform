package producer

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/IBM/sarama"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
	"go.uber.org/zap"
)

// KafkaProducer handles sending messages to Kafka
type KafkaProducer struct {
	producer sarama.SyncProducer
	topic    string
	logger   *zap.Logger
}

// NewKafkaProducer creates a new Kafka producer
func NewKafkaProducer(cfg *config.KafkaConfig, logger *zap.Logger) (*KafkaProducer, error) {
	saramaConfig := sarama.NewConfig()
	
	// Producer settings
	saramaConfig.Producer.Return.Successes = true
	saramaConfig.Producer.Return.Errors = true
	saramaConfig.Producer.Retry.Max = cfg.Producer.MaxRetries
	saramaConfig.Producer.Retry.Backoff = time.Duration(cfg.Producer.RetryBackoffMs) * time.Millisecond
	
	// Required acks
	switch cfg.Producer.RequiredAcks {
	case 0:
		saramaConfig.Producer.RequiredAcks = sarama.NoResponse
	case 1:
		saramaConfig.Producer.RequiredAcks = sarama.WaitForLocal
	case -1:
		saramaConfig.Producer.RequiredAcks = sarama.WaitForAll
	default:
		saramaConfig.Producer.RequiredAcks = sarama.WaitForLocal
	}

	// Compression
	switch cfg.Producer.Compression {
	case "gzip":
		saramaConfig.Producer.Compression = sarama.CompressionGZIP
	case "snappy":
		saramaConfig.Producer.Compression = sarama.CompressionSnappy
	case "lz4":
		saramaConfig.Producer.Compression = sarama.CompressionLZ4
	case "zstd":
		saramaConfig.Producer.Compression = sarama.CompressionZSTD
	default:
		saramaConfig.Producer.Compression = sarama.CompressionNone
	}

	producer, err := sarama.NewSyncProducer(cfg.Brokers, saramaConfig)
	if err != nil {
		return nil, fmt.Errorf("create kafka producer: %w", err)
	}

	return &KafkaProducer{
		producer: producer,
		topic:    cfg.Topic,
		logger:   logger,
	}, nil
}

// SendTransaction sends a transaction to Kafka
func (p *KafkaProducer) SendTransaction(ctx context.Context, network string, tx *model.Transaction) error {
	event := model.NewChainEvent("transaction", network, tx.BlockNumber, tx.Timestamp, tx)
	return p.sendEvent(ctx, tx.Hash, event)
}

// SendTransfer sends a transfer to Kafka
func (p *KafkaProducer) SendTransfer(ctx context.Context, network string, transfer *model.Transfer) error {
	event := model.NewChainEvent("transfer", network, transfer.BlockNumber, transfer.Timestamp, transfer)
	key := fmt.Sprintf("%s-%d", transfer.TxHash, transfer.LogIndex)
	return p.sendEvent(ctx, key, event)
}

// SendInternalTransaction sends an internal transaction to Kafka
func (p *KafkaProducer) SendInternalTransaction(ctx context.Context, network string, itx *model.InternalTransaction) error {
	event := model.NewChainEvent("internal_tx", network, itx.BlockNumber, time.Now(), itx)
	key := fmt.Sprintf("%s-%s", itx.Hash, itx.TraceID)
	return p.sendEvent(ctx, key, event)
}

// SendBatch sends multiple events to Kafka
func (p *KafkaProducer) SendBatch(ctx context.Context, events []*model.ChainEvent) error {
	messages := make([]*sarama.ProducerMessage, len(events))
	
	for i, event := range events {
		data, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("marshal event: %w", err)
		}

		// Use block number as key for ordering within partition
		key := fmt.Sprintf("%d", event.BlockNumber)
		
		messages[i] = &sarama.ProducerMessage{
			Topic: p.topic,
			Key:   sarama.StringEncoder(key),
			Value: sarama.ByteEncoder(data),
			Headers: []sarama.RecordHeader{
				{
					Key:   []byte("event_type"),
					Value: []byte(event.EventType),
				},
				{
					Key:   []byte("network"),
					Value: []byte(event.Network),
				},
			},
		}
	}

	return p.producer.SendMessages(messages)
}

// sendEvent sends a single event to Kafka
func (p *KafkaProducer) sendEvent(ctx context.Context, key string, event *model.ChainEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	msg := &sarama.ProducerMessage{
		Topic: p.topic,
		Key:   sarama.StringEncoder(key),
		Value: sarama.ByteEncoder(data),
		Headers: []sarama.RecordHeader{
			{
				Key:   []byte("event_type"),
				Value: []byte(event.EventType),
			},
			{
				Key:   []byte("network"),
				Value: []byte(event.Network),
			},
		},
	}

	partition, offset, err := p.producer.SendMessage(msg)
	if err != nil {
		p.logger.Error("Failed to send message",
			zap.String("key", key),
			zap.Error(err))
		return fmt.Errorf("send message: %w", err)
	}

	p.logger.Debug("Message sent",
		zap.String("key", key),
		zap.Int32("partition", partition),
		zap.Int64("offset", offset))

	return nil
}

// Close closes the Kafka producer
func (p *KafkaProducer) Close() error {
	return p.producer.Close()
}

// Producer interface for dependency injection
type Producer interface {
	SendTransaction(ctx context.Context, network string, tx *model.Transaction) error
	SendTransfer(ctx context.Context, network string, transfer *model.Transfer) error
	SendInternalTransaction(ctx context.Context, network string, itx *model.InternalTransaction) error
	SendBatch(ctx context.Context, events []*model.ChainEvent) error
	Close() error
}
