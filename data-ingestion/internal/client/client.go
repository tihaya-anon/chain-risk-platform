package client

import (
	"context"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
)

// BlockchainClient defines the interface for blockchain data retrieval
type BlockchainClient interface {
	// GetLatestBlockNumber returns the latest block number
	GetLatestBlockNumber(ctx context.Context) (uint64, error)

	// GetBlockByNumber returns a block with its transactions
	GetBlockByNumber(ctx context.Context, blockNumber uint64) (*model.Block, error)

	// GetTransactionsByBlock returns all transactions in a block
	GetTransactionsByBlock(ctx context.Context, blockNumber uint64) ([]*model.Transaction, error)

	// GetInternalTransactions returns internal transactions for a tx hash
	GetInternalTransactions(ctx context.Context, txHash string) ([]*model.InternalTransaction, error)

	// GetTokenTransfers returns token transfers for a block range
	GetTokenTransfers(ctx context.Context, startBlock, endBlock uint64) ([]*model.TokenTransfer, error)

	// GetNormalTransactions returns normal transactions for an address
	GetNormalTransactions(ctx context.Context, address string, startBlock, endBlock uint64) ([]*model.Transaction, error)

	// Network returns the network name (ethereum, bsc, etc.)
	Network() string

	// Close closes the client connection
	Close() error
}
