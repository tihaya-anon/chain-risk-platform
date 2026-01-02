package service

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/client"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/nacos"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
)

// Service handles the data ingestion logic
type Service struct {
	cfg         *config.Config
	client      client.BlockchainClient
	producer    producer.Producer
	logger      *zap.Logger
	nacosClient *nacos.Client

	lastProcessedBlock uint64
	mu                 sync.RWMutex

	// Manual control
	manualPaused atomic.Bool

	// Dynamic configuration from Nacos
	batchSize  atomic.Int32
	intervalMs atomic.Int32
}

// NewService creates a new ingestion service
func NewService(cfg *config.Config, client client.BlockchainClient, producer producer.Producer, logger *zap.Logger) *Service {
	svc := &Service{
		cfg:      cfg,
		client:   client,
		producer: producer,
		logger:   logger,
	}

	// Set default values from local config
	svc.batchSize.Store(int32(cfg.Blockchain.Polling.BatchSize))
	svc.intervalMs.Store(int32(cfg.GetPollingInterval().Milliseconds()))

	return svc
}

// SetNacosClient sets the Nacos client and registers for config changes
func (s *Service) SetNacosClient(nacosClient *nacos.Client) {
	s.nacosClient = nacosClient

	// Update from Nacos config
	s.updateFromNacos()

	// Register for config changes
	nacosClient.OnConfigChange(func(config *nacos.PipelineConfig) {
		s.updateFromNacos()
	})
}

// updateFromNacos updates service configuration from Nacos
func (s *Service) updateFromNacos() {
	if s.nacosClient == nil {
		return
	}

	config := s.nacosClient.GetConfig()

	if config.Pipeline.Ingestion.Polling.BatchSize > 0 {
		s.batchSize.Store(int32(config.Pipeline.Ingestion.Polling.BatchSize))
	}
	if config.Pipeline.Ingestion.Polling.IntervalMs > 0 {
		s.intervalMs.Store(int32(config.Pipeline.Ingestion.Polling.IntervalMs))
	}

	s.logger.Info("Configuration updated from Nacos",
		zap.Int32("batchSize", s.batchSize.Load()),
		zap.Int32("intervalMs", s.intervalMs.Load()))
}

// shouldRun checks if the service should run based on Nacos config and manual control
func (s *Service) shouldRun() bool {
	// Check Nacos config
	if s.nacosClient != nil {
		config := s.nacosClient.GetConfig()
		if !config.Pipeline.Enabled {
			s.logger.Debug("Skipping - pipeline disabled via Nacos")
			return false
		}
		if !config.Pipeline.Ingestion.Enabled {
			s.logger.Debug("Skipping - ingestion disabled via Nacos")
			return false
		}
	}

	// Check manual pause
	if s.manualPaused.Load() {
		s.logger.Debug("Skipping - manually paused")
		return false
	}

	return true
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

	// Start polling loop with dynamic interval
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("Shutting down ingestion service")
			return ctx.Err()
		default:
			// Check if we should run
			if !s.shouldRun() {
				time.Sleep(time.Second)
				continue
			}

			// Poll blocks
			if err := s.pollBlocks(ctx); err != nil {
				s.logger.Error("Error polling blocks", zap.Error(err))
			}

			// Use dynamic interval from Nacos
			interval := time.Duration(s.intervalMs.Load()) * time.Millisecond
			time.Sleep(interval)
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

// isBlockNotFoundError checks if an error is due to a block not being found
// This is used to handle cases where a block is requested but doesn't exist yet (e.g., during sync) or has been reorged out.
func (s *Service) isBlockNotFoundError(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found")
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

	// Use dynamic batch size from Nacos
	batchSize := uint64(s.batchSize.Load())
	startBlock := lastProcessed + 1
	endBlock := min64(startBlock+batchSize-1, safeBlock)

	s.logger.Info("Processing blocks",
		zap.Uint64("from", startBlock),
		zap.Uint64("to", endBlock),
		zap.Uint64("latest", latestBlock),
		zap.Uint64("batchSize", batchSize))

	for blockNum := startBlock; blockNum <= endBlock; blockNum++ {
		// Check if we should stop (manual pause during processing)
		if s.manualPaused.Load() {
			s.logger.Info("Processing interrupted by manual pause")
			break
		}

		if err := s.processBlock(ctx, blockNum); err != nil {
			if s.isBlockNotFoundError(err) {
				s.logger.Debug("Block not found",
					zap.Uint64("block", blockNum))
			} else {
				s.logger.Error("Error processing block",
					zap.Uint64("block", blockNum),
					zap.Error(err))
			}
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

// ==================== Manual Control Methods ====================

// Pause pauses the ingestion service
func (s *Service) Pause() {
	s.manualPaused.Store(true)
	s.logger.Info("Ingestion paused manually")
}

// Resume resumes the ingestion service
func (s *Service) Resume() {
	s.manualPaused.Store(false)
	s.logger.Info("Ingestion resumed")
}

// IsPaused returns whether the service is manually paused
func (s *Service) IsPaused() bool {
	return s.manualPaused.Load()
}

func min64(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}
