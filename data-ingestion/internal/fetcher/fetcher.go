package fetcher

import (
	"context"
	"encoding/json"
)

// Fetcher is responsible for fetching raw data from blockchain APIs
// This is the core data fetching layer that both ingestion and fixture-gen use
type Fetcher interface {
	// GetLatestBlockNumber returns the latest block number
	GetLatestBlockNumber(ctx context.Context) (uint64, error)

	// FetchBlockByNumber fetches raw block data by block number
	FetchBlockByNumber(ctx context.Context, blockNumber uint64) (json.RawMessage, error)

	// FetchInternalTransactions fetches raw internal transactions for a tx hash
	FetchInternalTransactions(ctx context.Context, txHash string) (json.RawMessage, error)

	// FetchAddressTransactions fetches raw transactions for an address
	FetchAddressTransactions(ctx context.Context, address string, startBlock, endBlock uint64) (json.RawMessage, error)

	// FetchTokenTransfers fetches raw token transfers for an address
	FetchTokenTransfers(ctx context.Context, address string, startBlock, endBlock uint64) (json.RawMessage, error)

	// Network returns the network name
	Network() string

	// Close closes the fetcher
	Close() error
}
