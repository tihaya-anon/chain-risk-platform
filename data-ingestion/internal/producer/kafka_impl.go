//go:build !test_mode

package producer

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/IBM/sarama"
	"go.uber.org/zap"
)

// KafkaProducer implements Producer interface using Kafka
type KafkaProducer struct {
	producer sarama.SyncProducer
	topic    string
	logger   *zap.Logger
}

// NewProducer creates a new Kafka producer (production mode)
func NewProducer(cfg *config.KafkaConfig, logger *zap.Logger) (Producer, error) {
	return NewKafkaProducer(cfg, logger)
}

// NewKafkaProducer creates a new Kafka producer instance
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

	logger.Info("Kafka producer initialized",
		zap.Strings("brokers", cfg.Brokers),
		zap.String("topic", cfg.Topic))

	return &KafkaProducer{
		producer: producer,
		topic:    cfg.Topic,
		logger:   logger,
	}, nil
}

// SendRawBlock sends raw block data to Kafka
func (p *KafkaProducer) SendRawBlock(ctx context.Context, data *RawBlockData) error {
	value, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal raw block data: %w", err)
	}

	// Use block number as key for ordering within partition
	key := fmt.Sprintf("%s-%d", data.Network, data.BlockNumber)

	msg := &sarama.ProducerMessage{
		Topic: p.topic,
		Key:   sarama.StringEncoder(key),
		Value: sarama.ByteEncoder(value),
		Headers: []sarama.RecordHeader{
			{
				Key:   []byte("network"),
				Value: []byte(data.Network),
			},
			{
				Key:   []byte("block_number"),
				Value: []byte(fmt.Sprintf("%d", data.BlockNumber)),
			},
		},
	}

	partition, offset, err := p.producer.SendMessage(msg)
	if err != nil {
		p.logger.Error("Failed to send raw block",
			zap.String("network", data.Network),
			zap.Uint64("blockNumber", data.BlockNumber),
			zap.Error(err))
		return fmt.Errorf("send message: %w", err)
	}

	p.logger.Debug("Raw block sent",
		zap.String("network", data.Network),
		zap.Uint64("blockNumber", data.BlockNumber),
		zap.Int32("partition", partition),
		zap.Int64("offset", offset))

	return nil
}

// SendRawBlocks sends multiple raw blocks in batch
func (p *KafkaProducer) SendRawBlocks(ctx context.Context, blocks []*RawBlockData) error {
	if len(blocks) == 0 {
		return nil
	}

	messages := make([]*sarama.ProducerMessage, len(blocks))

	for i, data := range blocks {
		value, err := json.Marshal(data)
		if err != nil {
			return fmt.Errorf("marshal raw block data: %w", err)
		}

		key := fmt.Sprintf("%s-%d", data.Network, data.BlockNumber)

		messages[i] = &sarama.ProducerMessage{
			Topic: p.topic,
			Key:   sarama.StringEncoder(key),
			Value: sarama.ByteEncoder(value),
			Headers: []sarama.RecordHeader{
				{
					Key:   []byte("network"),
					Value: []byte(data.Network),
				},
				{
					Key:   []byte("block_number"),
					Value: []byte(fmt.Sprintf("%d", data.BlockNumber)),
				},
			},
		}
	}

	if err := p.producer.SendMessages(messages); err != nil {
		p.logger.Error("Failed to send batch",
			zap.Int("count", len(messages)),
			zap.Error(err))
		return fmt.Errorf("send batch: %w", err)
	}

	p.logger.Debug("Batch sent",
		zap.Int("count", len(messages)))

	return nil
}

// Close closes the Kafka producer
func (p *KafkaProducer) Close() error {
	p.logger.Info("Closing Kafka producer")
	return p.producer.Close()
}
