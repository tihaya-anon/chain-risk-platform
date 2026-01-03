package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/fetcher"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/nacos"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
)

// Service handles the data ingestion logic
// It fetches raw block data from blockchain APIs and sends it to Kafka
// The raw JSON is sent as-is for downstream processing by stream-processor
type Service struct {
	cfg      *config.Config
	fetcher  fetcher.Fetcher
	producer producer.Producer
	logger   *zap.Logger

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
func NewService(cfg *config.Config, f fetcher.Fetcher, p producer.Producer, logger *zap.Logger) *Service {
	svc := &Service{
		cfg:      cfg,
		fetcher:  f,
		producer: p,
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
		latestBlock, err := s.fetcher.GetLatestBlockNumber(ctx)
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
func (s *Service) isBlockNotFoundError(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found")
}

// pollBlocks fetches and processes new blocks
func (s *Service) pollBlocks(ctx context.Context) error {
	latestBlock, err := s.fetcher.GetLatestBlockNumber(ctx)
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

// processBlock fetches raw block data and sends it to Kafka
func (s *Service) processBlock(ctx context.Context, blockNumber uint64) error {
	// Fetch raw block data from API
	rawBlock, err := s.fetcher.FetchBlockByNumber(ctx, blockNumber)
	if err != nil {
		return fmt.Errorf("fetch block %d: %w", blockNumber, err)
	}

	// Extract timestamp from raw block for the message
	timestamp := s.extractBlockTimestamp(rawBlock)

	// Check if block has valid data (filter out error responses)
	if !s.isValidBlockResponse(rawBlock) {
		s.logger.Warn("Invalid block response, skipping",
			zap.Uint64("block", blockNumber))
		return nil
	}

	// Create raw block data message
	data := &producer.RawBlockData{
		Network:     s.fetcher.Network(),
		BlockNumber: blockNumber,
		Timestamp:   timestamp,
		RawBlock:    rawBlock,
	}

	// Send to Kafka
	if err := s.producer.SendRawBlock(ctx, data); err != nil {
		return fmt.Errorf("send raw block %d: %w", blockNumber, err)
	}

	s.logger.Debug("Sent raw block to Kafka",
		zap.Uint64("block", blockNumber),
		zap.Int("size", len(rawBlock)))

	return nil
}

// extractBlockTimestamp extracts the timestamp from raw block JSON
func (s *Service) extractBlockTimestamp(rawBlock json.RawMessage) int64 {
	// Try to extract timestamp from the raw block
	// Etherscan API returns: {"result": {"timestamp": "0x..."}}
	var resp struct {
		Result struct {
			Timestamp string `json:"timestamp"`
		} `json:"result"`
	}

	if err := json.Unmarshal(rawBlock, &resp); err != nil {
		return time.Now().Unix()
	}

	if resp.Result.Timestamp == "" {
		return time.Now().Unix()
	}

	// Parse hex timestamp
	ts, err := strconv.ParseInt(strings.TrimPrefix(resp.Result.Timestamp, "0x"), 16, 64)
	if err != nil {
		return time.Now().Unix()
	}

	return ts
}

// isValidBlockResponse checks if the API response contains valid block data
func (s *Service) isValidBlockResponse(rawBlock json.RawMessage) bool {
	// Check for error responses or empty results
	var resp struct {
		Status  string          `json:"status"`
		Message string          `json:"message"`
		Result  json.RawMessage `json:"result"`
	}

	if err := json.Unmarshal(rawBlock, &resp); err != nil {
		return false
	}

	// Check for API error status
	if resp.Status == "0" {
		s.logger.Debug("API returned error status",
			zap.String("message", resp.Message))
		return false
	}

	// Check for null or empty result
	if len(resp.Result) == 0 || string(resp.Result) == "null" {
		return false
	}

	return true
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
