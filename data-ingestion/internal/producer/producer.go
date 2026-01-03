package producer

import (
	"context"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
)

// Producer defines the interface for sending chain events to message queue
type Producer interface {
	// SendTransaction sends a transaction event
	SendTransaction(ctx context.Context, network string, tx *model.Transaction) error

	// SendTransfer sends a transfer event
	SendTransfer(ctx context.Context, network string, transfer *model.Transfer) error

	// SendInternalTransaction sends an internal transaction event
	SendInternalTransaction(ctx context.Context, network string, itx *model.InternalTransaction) error

	// SendBatch sends multiple events in batch
	SendBatch(ctx context.Context, events []*model.ChainEvent) error

	// Close closes the producer connection
	Close() error
}
