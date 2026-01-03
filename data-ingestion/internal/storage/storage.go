package storage

import (
	"context"
	"encoding/json"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
)

// Storage handles persistence of fetched data
type Storage interface {
	// SaveBlock saves raw block data
	SaveBlock(ctx context.Context, blockNumber uint64, data json.RawMessage) error

	// SaveInternalTx saves raw internal transaction data
	SaveInternalTx(ctx context.Context, txHash string, data json.RawMessage) error

	// SaveAddressTxs saves raw address transaction data
	SaveAddressTxs(ctx context.Context, address string, startBlock, endBlock uint64, data json.RawMessage) error

	// SaveManifest saves the manifest file
	SaveManifest(ctx context.Context, manifest *Manifest) error

	// LoadManifest loads the manifest file
	LoadManifest(ctx context.Context) (*Manifest, error)

	// SaveTransaction saves a parsed transaction
	SaveTransaction(ctx context.Context, network string, tx *model.Transaction) error

	// SaveTransactions saves multiple transactions in batch
	SaveTransactions(ctx context.Context, network string, txs []*model.Transaction) error

	// SaveTransfer saves a parsed transfer
	SaveTransfer(ctx context.Context, network string, transfer *model.Transfer) error

	// SaveTransfers saves multiple transfers in batch
	SaveTransfers(ctx context.Context, network string, transfers []*model.Transfer) error

	// GetLastProcessedBlock returns the last processed block number for a processor
	GetLastProcessedBlock(ctx context.Context, network, processorType string) (uint64, error)

	// SetLastProcessedBlock updates the last processed block number
	SetLastProcessedBlock(ctx context.Context, network, processorType string, blockNumber uint64) error

	// Close closes the storage connection
	Close() error
}
