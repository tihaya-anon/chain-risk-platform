package client

import (
	"context"
	"fmt"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/fetcher"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/parser"
	"go.uber.org/zap"
)

// EtherscanClient implements BlockchainClient for Etherscan-compatible APIs
type EtherscanClient struct {
	fetcher fetcher.Fetcher
	parser  parser.Parser
	network string
	logger  *zap.Logger
}

// NewEtherscanClient creates a new Etherscan client
func NewEtherscanClient(network, baseURL, apiKey string, rateLimit int) (*EtherscanClient, error) {
	logger, _ := zap.NewProduction()

	// Create fetcher and parser
	f := fetcher.NewEtherscanFetcher(network, baseURL, apiKey, rateLimit, logger)
	p := parser.NewEtherscanParser()

	return &EtherscanClient{
		fetcher: f,
		parser:  p,
		network: network,
		logger:  logger,
	}, nil
}

// Network returns the network name
func (c *EtherscanClient) Network() string {
	return c.network
}

// Close closes the client
func (c *EtherscanClient) Close() error {
	return c.fetcher.Close()
}

// GetLatestBlockNumber returns the latest block number
func (c *EtherscanClient) GetLatestBlockNumber(ctx context.Context) (uint64, error) {
	return c.fetcher.GetLatestBlockNumber(ctx)
}

// GetBlockByNumber returns a block with its transactions
func (c *EtherscanClient) GetBlockByNumber(ctx context.Context, blockNumber uint64) (*model.Block, error) {
	raw, err := c.fetcher.FetchBlockByNumber(ctx, blockNumber)
	if err != nil {
		return nil, err
	}

	return c.parser.ParseBlock(raw)
}

// GetTransactionsByBlock returns all transactions in a block
func (c *EtherscanClient) GetTransactionsByBlock(ctx context.Context, blockNumber uint64) ([]*model.Transaction, error) {
	block, err := c.GetBlockByNumber(ctx, blockNumber)
	if err != nil {
		return nil, err
	}
	return block.Transactions, nil
}

// GetInternalTransactions returns internal transactions for a tx hash
func (c *EtherscanClient) GetInternalTransactions(ctx context.Context, txHash string) ([]*model.InternalTransaction, error) {
	raw, err := c.fetcher.FetchInternalTransactions(ctx, txHash)
	if err != nil {
		return nil, err
	}

	return c.parser.ParseInternalTransactions(raw, txHash)
}

// GetTokenTransfers returns token transfers for a block range
func (c *EtherscanClient) GetTokenTransfers(ctx context.Context, startBlock, endBlock uint64) ([]*model.TokenTransfer, error) {
	// Note: Etherscan doesn't support block range for token transfers directly
	// This would need to be implemented by iterating through blocks or using a different approach
	c.logger.Warn("GetTokenTransfers by block range not fully implemented",
		zap.Uint64("startBlock", startBlock),
		zap.Uint64("endBlock", endBlock))
	return nil, nil
}

// GetNormalTransactions returns normal transactions for an address
func (c *EtherscanClient) GetNormalTransactions(ctx context.Context, address string, startBlock, endBlock uint64) ([]*model.Transaction, error) {
	raw, err := c.fetcher.FetchAddressTransactions(ctx, address, startBlock, endBlock)
	if err != nil {
		return nil, fmt.Errorf("fetch address transactions: %w", err)
	}

	return c.parser.ParseNormalTransactions(raw)
}
