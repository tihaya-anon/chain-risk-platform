package fetcher

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"go.uber.org/zap"
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

// EtherscanFetcher implements Fetcher for Etherscan-compatible APIs
type EtherscanFetcher struct {
	network     string
	baseURL     string
	apiKey      string
	chainID     string
	httpClient  *http.Client
	rateLimiter *rateLimiter
	logger      *zap.Logger
}

// rateLimiter implements a simple token bucket rate limiter
type rateLimiter struct {
	mu        sync.Mutex
	tokens    int
	maxTokens int
	interval  time.Duration
	lastTime  time.Time
}

func newRateLimiter(rateLimit int) *rateLimiter {
	return &rateLimiter{
		tokens:    rateLimit,
		maxTokens: rateLimit,
		interval:  time.Second,
		lastTime:  time.Now(),
	}
}

func (r *rateLimiter) Wait() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(r.lastTime)

	// Refill tokens based on elapsed time
	tokensToAdd := int(elapsed/r.interval) * r.maxTokens
	r.tokens = min(r.tokens+tokensToAdd, r.maxTokens)
	r.lastTime = now

	if r.tokens <= 0 {
		sleepTime := r.interval - (elapsed % r.interval)
		time.Sleep(sleepTime)
		r.tokens = r.maxTokens
		r.lastTime = time.Now()
	}

	r.tokens--
}

// NewEtherscanFetcher creates a new Etherscan fetcher
func NewEtherscanFetcher(network, baseURL, apiKey string, rateLimit int, logger *zap.Logger) *EtherscanFetcher {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}

	// Determine chainID based on network
	chainID := "1" // Ethereum mainnet
	if network == "bsc" {
		chainID = "56" // BSC mainnet
	}

	return &EtherscanFetcher{
		network: network,
		baseURL: baseURL,
		apiKey:  apiKey,
		chainID: chainID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		rateLimiter: newRateLimiter(rateLimit),
		logger:      logger,
	}
}

// Network returns the network name
func (f *EtherscanFetcher) Network() string {
	return f.network
}

// Close closes the fetcher
func (f *EtherscanFetcher) Close() error {
	f.httpClient.CloseIdleConnections()
	return nil
}

// doRequest performs an HTTP request with rate limiting and returns raw response
func (f *EtherscanFetcher) doRequest(ctx context.Context, url string) (json.RawMessage, error) {
	f.rateLimiter.Wait()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	return json.RawMessage(body), nil
}

// GetLatestBlockNumber returns the latest block number
func (f *EtherscanFetcher) GetLatestBlockNumber(ctx context.Context) (uint64, error) {
	url := fmt.Sprintf("%s&chainid=%s&module=proxy&action=eth_blockNumber&apikey=%s", f.baseURL, f.chainID, f.apiKey)

	body, err := f.doRequest(ctx, url)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Result  string `json:"result"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, fmt.Errorf("unmarshal response: %w", err)
	}

	// Check for API error response
	if resp.Status == "0" || (resp.Message != "" && resp.Message != "OK") {
		return 0, fmt.Errorf("API error: %s (result: %s)", resp.Message, resp.Result)
	}

	// Check if result looks like an error message rather than a hex number
	if len(resp.Result) > 0 && resp.Result[0] != '0' {
		return 0, fmt.Errorf("API error: %s", resp.Result)
	}

	blockNumber, err := strconv.ParseUint(resp.Result, 0, 64)
	if err != nil {
		return 0, fmt.Errorf("parse block number: %w", err)
	}

	return blockNumber, nil
}

// FetchBlockByNumber fetches raw block data by block number
func (f *EtherscanFetcher) FetchBlockByNumber(ctx context.Context, blockNumber uint64) (json.RawMessage, error) {
	url := fmt.Sprintf("%s&chainid=%s&module=proxy&action=eth_getBlockByNumber&tag=0x%x&boolean=true&apikey=%s",
		f.baseURL, f.chainID, blockNumber, f.apiKey)

	body, err := f.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch block: %w", err)
	}

	// Validate response has result field
	var resp struct {
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if len(resp.Result) == 0 || string(resp.Result) == "null" {
		return nil, fmt.Errorf("block not found: %d", blockNumber)
	}

	return body, nil
}

// FetchInternalTransactions fetches raw internal transactions for a tx hash
func (f *EtherscanFetcher) FetchInternalTransactions(ctx context.Context, txHash string) (json.RawMessage, error) {
	url := fmt.Sprintf("%s&chainid=%s&module=account&action=txlistinternal&txhash=%s&apikey=%s",
		f.baseURL, f.chainID, txHash, f.apiKey)

	body, err := f.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch internal txs: %w", err)
	}

	return body, nil
}

// FetchAddressTransactions fetches raw transactions for an address
func (f *EtherscanFetcher) FetchAddressTransactions(ctx context.Context, address string, startBlock, endBlock uint64) (json.RawMessage, error) {
	url := fmt.Sprintf("%s&chainid=%s&module=account&action=txlist&address=%s&startblock=%d&endblock=%d&sort=asc&apikey=%s",
		f.baseURL, f.chainID, address, startBlock, endBlock, f.apiKey)

	body, err := f.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch address txs: %w", err)
	}

	return body, nil
}

// FetchTokenTransfers fetches raw token transfers for an address
func (f *EtherscanFetcher) FetchTokenTransfers(ctx context.Context, address string, startBlock, endBlock uint64) (json.RawMessage, error) {
	url := fmt.Sprintf("%s&chainid=%s&module=account&action=tokentx&address=%s&startblock=%d&endblock=%d&sort=asc&apikey=%s",
		f.baseURL, f.chainID, address, startBlock, endBlock, f.apiKey)

	body, err := f.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch token transfers: %w", err)
	}

	return body, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
