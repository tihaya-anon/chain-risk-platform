//go:build test_mode

package producer

import (
	"context"
	"sync/atomic"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
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

// SendTransaction logs the transaction but does not send it
func (p *NoopProducer) SendTransaction(ctx context.Context, network string, tx *model.Transaction) error {
	atomic.AddInt64(&p.messageCount, 1)
	p.logger.Debug("Noop: would send transaction",
		zap.String("network", network),
		zap.String("hash", tx.Hash),
		zap.Uint64("block", tx.BlockNumber))
	return nil
}

// SendTransfer logs the transfer but does not send it
func (p *NoopProducer) SendTransfer(ctx context.Context, network string, transfer *model.Transfer) error {
	atomic.AddInt64(&p.messageCount, 1)
	p.logger.Debug("Noop: would send transfer",
		zap.String("network", network),
		zap.String("txHash", transfer.TxHash),
		zap.Uint("logIndex", transfer.LogIndex))
	return nil
}

// SendInternalTransaction logs the internal transaction but does not send it
func (p *NoopProducer) SendInternalTransaction(ctx context.Context, network string, itx *model.InternalTransaction) error {
	atomic.AddInt64(&p.messageCount, 1)
	p.logger.Debug("Noop: would send internal transaction",
		zap.String("network", network),
		zap.String("hash", itx.Hash),
		zap.String("traceId", itx.TraceID))
	return nil
}

// SendBatch logs the batch but does not send it
func (p *NoopProducer) SendBatch(ctx context.Context, events []*model.ChainEvent) error {
	count := int64(len(events))
	atomic.AddInt64(&p.messageCount, count)
	atomic.AddInt64(&p.batchCount, 1)
	p.logger.Debug("Noop: would send batch",
		zap.Int64("eventCount", count),
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
