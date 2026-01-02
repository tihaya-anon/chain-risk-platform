// fixture-gen is a tool to fetch real blockchain API responses and save them as test fixtures.
// These fixtures can be used by the mock server for integration testing.
//
// Usage:
//
//	fixture-gen -network ethereum -output ../../tests/integration/fixtures
//	fixture-gen -network ethereum -blocks 19000000,19000001,19000002
//	fixture-gen -network ethereum -address 0x... -start-block 19000000 -end-block 19000100
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/fetcher"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/storage"
	"go.uber.org/zap"
)

var (
	network   = flag.String("network", "ethereum", "Blockchain network (ethereum, bsc)")
	outputDir = flag.String("output", "../../tests/integration/fixtures", "Output directory for fixtures")

	// API configuration
	baseURL = flag.String("base-url", "", "API base URL (default: etherscan.io or bscscan.com)")
	apiKey  = flag.String("api-key", "", "API key (or set ETHERSCAN_API_KEY / BSCSCAN_API_KEY env var)")

	// Block fetching options
	blocks     = flag.String("blocks", "", "Comma-separated list of block numbers to fetch")
	startBlock = flag.Uint64("start-block", 0, "Start block number for range fetch")
	endBlock   = flag.Uint64("end-block", 0, "End block number for range fetch")
	latest     = flag.Int("latest", 0, "Fetch the latest N blocks")

	// Address transaction options
	address = flag.String("address", "", "Address to fetch transactions for")

	// Transaction options
	txHashes = flag.String("tx-hashes", "", "Comma-separated list of transaction hashes to fetch internal txs")

	// Options
	includeInternalTxs = flag.Bool("internal-txs", true, "Fetch internal transactions for each tx")
	rateLimit          = flag.Int("rate-limit", 5, "API requests per second")
	verbose            = flag.Bool("verbose", false, "Verbose output")
)

// NetworkConfig holds network-specific configuration
type NetworkConfig struct {
	Name    string
	BaseURL string
	APIKey  string
}

func main() {
	flag.Parse()

	// Initialize logger
	var logger *zap.Logger
	var err error
	if *verbose {
		logger, err = zap.NewDevelopment()
	} else {
		logger, err = zap.NewProduction()
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Build network config
	netCfg := buildNetworkConfig(*network, *baseURL, *apiKey)
	if netCfg.APIKey == "" {
		logger.Fatal("API key is required. Use -api-key flag or set ETHERSCAN_API_KEY/BSCSCAN_API_KEY env var")
	}

	logger.Info("Using API configuration",
		zap.String("network", netCfg.Name),
		zap.String("baseURL", netCfg.BaseURL))

	// Create fetcher
	f := fetcher.NewEtherscanFetcher(netCfg.Name, netCfg.BaseURL, netCfg.APIKey, *rateLimit, logger)
	defer f.Close()

	// Create storage
	store, err := storage.NewFileStorage(*outputDir, *network)
	if err != nil {
		logger.Fatal("Failed to create storage", zap.Error(err))
	}

	ctx := context.Background()

	// Load or create manifest
	manifest, err := store.LoadManifest()
	if err != nil {
		logger.Fatal("Failed to load manifest", zap.Error(err))
	}
	manifest.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	manifest.Network = *network
	manifest.APISource = netCfg.BaseURL

	// Determine which blocks to fetch
	blockNumbers := []uint64{}

	if *blocks != "" {
		// Parse comma-separated block numbers
		for _, b := range strings.Split(*blocks, ",") {
			var num uint64
			if _, err := fmt.Sscanf(strings.TrimSpace(b), "%d", &num); err == nil {
				blockNumbers = append(blockNumbers, num)
			}
		}
	} else if *startBlock > 0 && *endBlock >= *startBlock {
		// Range of blocks
		for b := *startBlock; b <= *endBlock; b++ {
			blockNumbers = append(blockNumbers, b)
		}
	} else if *latest > 0 {
		// Fetch latest N blocks
		latestNum, err := f.GetLatestBlockNumber(ctx)
		if err != nil {
			logger.Fatal("Failed to get latest block number", zap.Error(err))
		}
		for i := 0; i < *latest; i++ {
			blockNumbers = append(blockNumbers, latestNum-uint64(i))
		}
	}

	// Fetch blocks
	if len(blockNumbers) > 0 {
		logger.Info("Fetching blocks", zap.Int("count", len(blockNumbers)))

		for _, blockNum := range blockNumbers {
			if err := fetchAndSaveBlock(ctx, f, store, blockNum, *includeInternalTxs, manifest, logger); err != nil {
				logger.Error("Failed to fetch block", zap.Uint64("block", blockNum), zap.Error(err))
				continue
			}
		}
	}

	// Fetch address transactions
	if *address != "" && *startBlock > 0 && *endBlock > 0 {
		logger.Info("Fetching address transactions",
			zap.String("address", *address),
			zap.Uint64("startBlock", *startBlock),
			zap.Uint64("endBlock", *endBlock))

		raw, err := f.FetchAddressTransactions(ctx, *address, *startBlock, *endBlock)
		if err != nil {
			logger.Fatal("Failed to fetch address transactions", zap.Error(err))
		}

		// Save to storage
		if err := store.SaveAddressTxs(*address, *startBlock, *endBlock, raw); err != nil {
			logger.Fatal("Failed to save address transactions", zap.Error(err))
		}

		// Parse for manifest
		var txResp struct {
			Result []interface{} `json:"result"`
		}
		json.Unmarshal(raw, &txResp)

		filename := fmt.Sprintf("%s_%d_%d.json", *address, *startBlock, *endBlock)
		manifest.Addresses = append(manifest.Addresses, storage.AddressManifest{
			Address:     *address,
			StartBlock:  *startBlock,
			EndBlock:    *endBlock,
			TxCount:     len(txResp.Result),
			FixtureFile: filepath.Join("addresses", filename),
		})

		logger.Info("Saved address fixture",
			zap.String("address", *address),
			zap.Int("txCount", len(txResp.Result)))
	}

	// Fetch internal transactions by hash
	if *txHashes != "" {
		hashes := strings.Split(*txHashes, ",")
		logger.Info("Fetching internal transactions", zap.Int("count", len(hashes)))

		for _, hash := range hashes {
			hash = strings.TrimSpace(hash)
			resp, err := f.FetchInternalTransactions(ctx, hash)
			if err != nil {
				logger.Error("Failed to fetch internal txs", zap.String("hash", hash), zap.Error(err))
				continue
			}

			if err := store.SaveInternalTx(hash, resp); err != nil {
				logger.Error("Failed to save internal txs", zap.Error(err))
				continue
			}

			logger.Info("Saved internal txs fixture", zap.String("hash", hash))
		}
	}

	// Save manifest
	if err := store.SaveManifest(manifest); err != nil {
		logger.Fatal("Failed to save manifest", zap.Error(err))
	}

	logger.Info("Fixture generation complete",
		zap.Int("blocks", len(manifest.Blocks)),
		zap.Int("addresses", len(manifest.Addresses)))
}

// fetchAndSaveBlock fetches a block and saves it to storage
func fetchAndSaveBlock(ctx context.Context, f fetcher.Fetcher, store storage.Storage, blockNum uint64, includeInternalTxs bool, manifest *storage.Manifest, logger *zap.Logger) error {
	// Fetch block
	blockResp, err := f.FetchBlockByNumber(ctx, blockNum)
	if err != nil {
		return fmt.Errorf("fetch block: %w", err)
	}

	// Save block
	if err := store.SaveBlock(blockNum, blockResp); err != nil {
		return fmt.Errorf("save block: %w", err)
	}

	// Parse block for manifest
	var blockData struct {
		Result struct {
			Hash         string        `json:"hash"`
			Timestamp    string        `json:"timestamp"`
			Transactions []interface{} `json:"transactions"`
		} `json:"result"`
	}
	json.Unmarshal(blockResp, &blockData)

	filename := fmt.Sprintf("%d.json", blockNum)
	manifest.Blocks = append(manifest.Blocks, storage.BlockManifest{
		Number:      blockNum,
		Hash:        blockData.Result.Hash,
		TxCount:     len(blockData.Result.Transactions),
		Timestamp:   blockData.Result.Timestamp,
		FixtureFile: filepath.Join("blocks", filename),
	})

	logger.Info("Saved block fixture",
		zap.Uint64("block", blockNum),
		zap.Int("txCount", len(blockData.Result.Transactions)))

	// Fetch internal transactions if requested
	if includeInternalTxs {
		for _, tx := range blockData.Result.Transactions {
			txMap, ok := tx.(map[string]interface{})
			if !ok {
				continue
			}
			txHash, ok := txMap["hash"].(string)
			if !ok {
				continue
			}

			internalResp, err := f.FetchInternalTransactions(ctx, txHash)
			if err != nil {
				logger.Warn("Failed to fetch internal txs",
					zap.String("hash", txHash),
					zap.Error(err))
				continue
			}

			if err := store.SaveInternalTx(txHash, internalResp); err != nil {
				logger.Warn("Failed to save internal txs",
					zap.String("hash", txHash),
					zap.Error(err))
				continue
			}
		}
	}

	return nil
}

// buildNetworkConfig creates network configuration from flags and environment
func buildNetworkConfig(network, baseURL, apiKey string) *NetworkConfig {
	cfg := &NetworkConfig{Name: network}

	switch network {
	case "ethereum":
		if baseURL != "" {
			cfg.BaseURL = baseURL
		} else {
			cfg.BaseURL = "https://api.etherscan.io/v2/api?"
		}
		if apiKey != "" {
			cfg.APIKey = apiKey
		} else {
			cfg.APIKey = os.Getenv("ETHERSCAN_API_KEY")
		}
	case "bsc":
		if baseURL != "" {
			cfg.BaseURL = baseURL
		} else {
			cfg.BaseURL = "https://api.bscscan.com/api?"
		}
		if apiKey != "" {
			cfg.APIKey = apiKey
		} else {
			cfg.APIKey = os.Getenv("BSCSCAN_API_KEY")
		}
	default:
		// Custom network - require explicit base URL
		cfg.BaseURL = baseURL
		cfg.APIKey = apiKey
	}

	return cfg
}
