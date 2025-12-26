package service

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"sync"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/client"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
)

// Service handles the data ingestion logic
type Service struct {
	cfg      *config.Config
	client   client.BlockchainClient
	producer producer.Producer
	logger   *zap.Logger

	lastProcessedBlock uint64
	mu                 sync.RWMutex
}

// NewService creates a new ingestion service
func NewService(cfg *config.Config, client client.BlockchainClient, producer producer.Producer, logger *zap.Logger) *Service {
	return &Service{
		cfg:      cfg,
		client:   client,
		producer: producer,
		logger:   logger,
	}
}

// Start begins the data ingestion process
func (s *Service) Start(ctx context.Context) error {
	s.logger.Info("Starting data ingestion service",
		zap.String("network", s.cfg.Blockchain.Network),
		zap.String("startBlock", s.cfg.Blockchain.Polling.StartBlock))

	// Determine starting block
	startBlock, err := s.determineStartBlock(ctx)
	if err != nil {
		return fmt.Errorf("determine start block: %w", err)
	}

	s.mu.Lock()
	s.lastProcessedBlock = startBlock - 1
	s.mu.Unlock()

	s.logger.Info("Starting from block", zap.Uint64("block", startBlock))

	// Start polling loop
	ticker := time.NewTicker(s.cfg.GetPollingInterval())
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("Shutting down ingestion service")
			return ctx.Err()
		case <-ticker.C:
			if err := s.pollBlocks(ctx); err != nil {
				s.logger.Error("Error polling blocks", zap.Error(err))
				// Continue polling despite errors
			}
		}
	}
}

// determineStartBlock determines the starting block number
func (s *Service) determineStartBlock(ctx context.Context) (uint64, error) {
	startBlockCfg := s.cfg.Blockchain.Polling.StartBlock

	if startBlockCfg == "latest" {
		latestBlock, err := s.client.GetLatestBlockNumber(ctx)
		if err != nil {
			return 0, fmt.Errorf("get latest block: %w", err)
		}
		// Start from a few blocks back to ensure we don't miss anything
		confirmations := uint64(s.cfg.Blockchain.Polling.Confirmations)
		if latestBlock > confirmations {
			return latestBlock - confirmations, nil
		}
		return 1, nil
	}

	// Parse as specific block number
	blockNum, err := strconv.ParseUint(startBlockCfg, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse start block: %w", err)
	}
	return blockNum, nil
}

// pollBlocks fetches and processes new blocks
func (s *Service) pollBlocks(ctx context.Context) error {
	latestBlock, err := s.client.GetLatestBlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get latest block: %w", err)
	}

	// Account for confirmations
	safeBlock := latestBlock - uint64(s.cfg.Blockchain.Polling.Confirmations)

	s.mu.RLock()
	lastProcessed := s.lastProcessedBlock
	s.mu.RUnlock()

	if safeBlock <= lastProcessed {
		s.logger.Debug("No new blocks to process",
			zap.Uint64("latestBlock", latestBlock),
			zap.Uint64("safeBlock", safeBlock),
			zap.Uint64("lastProcessed", lastProcessed))
		return nil
	}

	// Process blocks in batches
	batchSize := uint64(s.cfg.Blockchain.Polling.BatchSize)
	startBlock := lastProcessed + 1
	endBlock := min64(startBlock+batchSize-1, safeBlock)

	s.logger.Info("Processing blocks",
		zap.Uint64("from", startBlock),
		zap.Uint64("to", endBlock),
		zap.Uint64("latest", latestBlock))

	for blockNum := startBlock; blockNum <= endBlock; blockNum++ {
		if err := s.processBlock(ctx, blockNum); err != nil {
			s.logger.Error("Error processing block",
				zap.Uint64("block", blockNum),
				zap.Error(err))
			// Continue with next block
			continue
		}

		s.mu.Lock()
		s.lastProcessedBlock = blockNum
		s.mu.Unlock()
	}

	return nil
}

// processBlock processes a single block
func (s *Service) processBlock(ctx context.Context, blockNumber uint64) error {
	block, err := s.client.GetBlockByNumber(ctx, blockNumber)
	if err != nil {
		return fmt.Errorf("get block %d: %w", blockNumber, err)
	}

	s.logger.Debug("Processing block",
		zap.Uint64("block", blockNumber),
		zap.Int("txCount", len(block.Transactions)))

	// Process each transaction
	for _, tx := range block.Transactions {
		// Send transaction to Kafka
		if err := s.producer.SendTransaction(ctx, s.client.Network(), tx); err != nil {
			s.logger.Error("Error sending transaction",
				zap.String("txHash", tx.Hash),
				zap.Error(err))
			continue
		}

		// Extract and send native transfer
		if tx.Value != nil && tx.Value.Cmp(big.NewInt(0)) > 0 {
			transfer := s.extractNativeTransfer(tx)
			if err := s.producer.SendTransfer(ctx, s.client.Network(), transfer); err != nil {
				s.logger.Error("Error sending transfer",
					zap.String("txHash", tx.Hash),
					zap.Error(err))
			}
		}

		// Get internal transactions (expensive API calls, disabled by default)
		if s.cfg.Blockchain.Polling.EnableInternalTx {
			s.processInternalTransactions(ctx, tx.Hash)
		}
	}

	return nil
}

// extractNativeTransfer extracts a native token transfer from a transaction
func (s *Service) extractNativeTransfer(tx *model.Transaction) *model.Transfer {
	symbol := "ETH"
	if s.cfg.Blockchain.Network == "bsc" {
		symbol = "BNB"
	}

	return &model.Transfer{
		TxHash:       tx.Hash,
		BlockNumber:  tx.BlockNumber,
		LogIndex:     0,
		From:         tx.From,
		To:           tx.To,
		Value:        tx.Value,
		TokenAddress: "", // empty for native token
		TokenSymbol:  symbol,
		TokenDecimal: 18,
		Timestamp:    tx.Timestamp,
		TransferType: "native",
	}
}

// processInternalTransactions fetches and sends internal transactions
func (s *Service) processInternalTransactions(ctx context.Context, txHash string) {
	internalTxs, err := s.client.GetInternalTransactions(ctx, txHash)
	if err != nil {
		s.logger.Error("Error getting internal transactions",
			zap.String("txHash", txHash),
			zap.Error(err))
		return
	}

	for _, itx := range internalTxs {
		if err := s.producer.SendInternalTransaction(ctx, s.client.Network(), itx); err != nil {
			s.logger.Error("Error sending internal transaction",
				zap.String("txHash", txHash),
				zap.String("traceId", itx.TraceID),
				zap.Error(err))
		}
	}
}

// GetLastProcessedBlock returns the last processed block number
func (s *Service) GetLastProcessedBlock() uint64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastProcessedBlock
}

func min64(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}
