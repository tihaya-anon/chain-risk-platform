//go:build test_mode

package producer

import (
	"context"
	"sync/atomic"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"go.uber.org/zap"
)

// NoopProducer implements Producer interface but does not send messages
// Used for testing and development without Kafka dependency
type NoopProducer struct {
	logger       *zap.Logger
	messageCount int64
	batchCount   int64
}

// NewProducer creates a new Noop producer (test mode)
func NewProducer(cfg *config.KafkaConfig, logger *zap.Logger) (Producer, error) {
	logger.Warn("Running in TEST MODE - Kafka messages will NOT be sent",
		zap.String("topic", cfg.Topic),
		zap.Strings("brokers", cfg.Brokers))
	return NewNoopProducer(logger), nil
}

// NewNoopProducer creates a new Noop producer instance
func NewNoopProducer(logger *zap.Logger) *NoopProducer {
	return &NoopProducer{
		logger: logger,
	}
}

// SendRawBlock logs the raw block but does not send it
func (p *NoopProducer) SendRawBlock(ctx context.Context, data *RawBlockData) error {
	atomic.AddInt64(&p.messageCount, 1)
	p.logger.Debug("Noop: would send raw block",
		zap.String("network", data.Network),
		zap.Uint64("blockNumber", data.BlockNumber),
		zap.Int("rawBlockSize", len(data.RawBlock)))
	return nil
}

// SendRawBlocks logs the batch but does not send it
func (p *NoopProducer) SendRawBlocks(ctx context.Context, blocks []*RawBlockData) error {
	count := int64(len(blocks))
	atomic.AddInt64(&p.messageCount, count)
	atomic.AddInt64(&p.batchCount, 1)
	p.logger.Debug("Noop: would send raw blocks batch",
		zap.Int64("blockCount", count),
		zap.Int64("totalMessages", atomic.LoadInt64(&p.messageCount)),
		zap.Int64("totalBatches", atomic.LoadInt64(&p.batchCount)))
	return nil
}

// Close closes the noop producer (no-op)
func (p *NoopProducer) Close() error {
	p.logger.Info("Noop producer closed",
		zap.Int64("totalMessages", atomic.LoadInt64(&p.messageCount)),
		zap.Int64("totalBatches", atomic.LoadInt64(&p.batchCount)))
	return nil
}

// Stats returns the message statistics
func (p *NoopProducer) Stats() (messages int64, batches int64) {
	return atomic.LoadInt64(&p.messageCount), atomic.LoadInt64(&p.batchCount)
}
