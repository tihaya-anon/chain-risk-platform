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

// Manifest tracks all fetched fixtures
type Manifest struct {
	Version     string            `json:"version"`
	GeneratedAt string            `json:"generatedAt"`
	Network     string            `json:"network"`
	APISource   string            `json:"apiSource"`
	Blocks      []BlockManifest   `json:"blocks,omitempty"`
	Addresses   []AddressManifest `json:"addresses,omitempty"`
}

type BlockManifest struct {
	Number      uint64 `json:"number"`
	Hash        string `json:"hash"`
	TxCount     int    `json:"txCount"`
	Timestamp   string `json:"timestamp"`
	FixtureFile string `json:"fixtureFile"`
}

type AddressManifest struct {
	Address     string `json:"address"`
	StartBlock  uint64 `json:"startBlock"`
	EndBlock    uint64 `json:"endBlock"`
	TxCount     int    `json:"txCount"`
	FixtureFile string `json:"fixtureFile"`
}

// BlockFixture contains all data related to a block
type BlockFixture struct {
	Network       string                     `json:"network"`
	BlockNumber   uint64                     `json:"blockNumber"`
	FetchedAt     string                     `json:"fetchedAt"`
	BlockResponse json.RawMessage            `json:"blockResponse"`
	InternalTxs   map[string]json.RawMessage `json:"internalTxs,omitempty"`
}

// AddressFixture contains transaction data for an address
type AddressFixture struct {
	Network        string          `json:"network"`
	Address        string          `json:"address"`
	StartBlock     uint64          `json:"startBlock"`
	EndBlock       uint64          `json:"endBlock"`
	FetchedAt      string          `json:"fetchedAt"`
	TxListResponse json.RawMessage `json:"txListResponse"`
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
	fetcher := NewFixtureFetcher(netCfg, *rateLimit, logger)

	// Create output directories
	networkDir := filepath.Join(*outputDir, *network)
	blocksDir := filepath.Join(networkDir, "blocks")
	addressesDir := filepath.Join(networkDir, "addresses")

	for _, dir := range []string{blocksDir, addressesDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			logger.Fatal("Failed to create directory", zap.String("dir", dir), zap.Error(err))
		}
	}

	ctx := context.Background()
	manifest := &Manifest{
		Version:     "1.0",
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Network:     *network,
		APISource:   netCfg.BaseURL,
	}

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
		latestNum, err := fetcher.GetLatestBlockNumber(ctx)
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
			fixture, err := fetcher.FetchBlock(ctx, blockNum, *includeInternalTxs)
			if err != nil {
				logger.Error("Failed to fetch block", zap.Uint64("block", blockNum), zap.Error(err))
				continue
			}

			// Save fixture
			filename := fmt.Sprintf("%d.json", blockNum)
			fixturePath := filepath.Join(blocksDir, filename)
			if err := saveJSON(fixturePath, fixture); err != nil {
				logger.Error("Failed to save fixture", zap.String("path", fixturePath), zap.Error(err))
				continue
			}

			// Parse block for manifest
			var blockResp struct {
				Result struct {
					Hash         string        `json:"hash"`
					Timestamp    string        `json:"timestamp"`
					Transactions []interface{} `json:"transactions"`
				} `json:"result"`
			}
			json.Unmarshal(fixture.BlockResponse, &blockResp)

			manifest.Blocks = append(manifest.Blocks, BlockManifest{
				Number:      blockNum,
				Hash:        blockResp.Result.Hash,
				TxCount:     len(blockResp.Result.Transactions),
				Timestamp:   blockResp.Result.Timestamp,
				FixtureFile: filepath.Join("blocks", filename),
			})

			logger.Info("Saved block fixture",
				zap.Uint64("block", blockNum),
				zap.Int("txCount", len(blockResp.Result.Transactions)),
				zap.Int("internalTxCount", len(fixture.InternalTxs)))
		}
	}

	// Fetch address transactions
	if *address != "" && *startBlock > 0 && *endBlock > 0 {
		logger.Info("Fetching address transactions",
			zap.String("address", *address),
			zap.Uint64("startBlock", *startBlock),
			zap.Uint64("endBlock", *endBlock))

		fixture, err := fetcher.FetchAddressTransactions(ctx, *address, *startBlock, *endBlock)
		if err != nil {
			logger.Fatal("Failed to fetch address transactions", zap.Error(err))
		}

		// Save fixture
		filename := fmt.Sprintf("%s_%d_%d.json", *address, *startBlock, *endBlock)
		fixturePath := filepath.Join(addressesDir, filename)
		if err := saveJSON(fixturePath, fixture); err != nil {
			logger.Fatal("Failed to save fixture", zap.Error(err))
		}

		// Parse for manifest
		var txResp struct {
			Result []interface{} `json:"result"`
		}
		json.Unmarshal(fixture.TxListResponse, &txResp)

		manifest.Addresses = append(manifest.Addresses, AddressManifest{
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

		internalTxsDir := filepath.Join(networkDir, "internal_txs")
		os.MkdirAll(internalTxsDir, 0755)

		for _, hash := range hashes {
			hash = strings.TrimSpace(hash)
			resp, err := fetcher.FetchInternalTransactions(ctx, hash)
			if err != nil {
				logger.Error("Failed to fetch internal txs", zap.String("hash", hash), zap.Error(err))
				continue
			}

			filename := fmt.Sprintf("%s.json", hash)
			fixturePath := filepath.Join(internalTxsDir, filename)
			if err := saveJSON(fixturePath, resp); err != nil {
				logger.Error("Failed to save internal txs", zap.Error(err))
				continue
			}

			logger.Info("Saved internal txs fixture", zap.String("hash", hash))
		}
	}

	// Save manifest
	manifestPath := filepath.Join(networkDir, "manifest.json")
	if err := saveJSON(manifestPath, manifest); err != nil {
		logger.Fatal("Failed to save manifest", zap.Error(err))
	}

	logger.Info("Fixture generation complete",
		zap.Int("blocks", len(manifest.Blocks)),
		zap.Int("addresses", len(manifest.Addresses)),
		zap.String("manifest", manifestPath))
}

// buildNetworkConfig creates network configuration from flags and environment
func buildNetworkConfig(network, baseURL, apiKey string) *NetworkConfig {
	cfg := &NetworkConfig{Name: network}

	switch network {
	case "ethereum":
		if baseURL != "" {
			cfg.BaseURL = baseURL
		} else {
			cfg.BaseURL = "https://api.etherscan.io/api?"
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

func saveJSON(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
