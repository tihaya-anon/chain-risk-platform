package main

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

// FixtureFetcher fetches raw API responses for test fixtures
type FixtureFetcher struct {
	network     string
	baseURL     string
	apiKey      string
	httpClient  *http.Client
	rateLimiter *rateLimiter
	logger      *zap.Logger
}

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

// NewFixtureFetcher creates a new fixture fetcher
func NewFixtureFetcher(cfg *NetworkConfig, rateLimit int, logger *zap.Logger) *FixtureFetcher {
	return &FixtureFetcher{
		network: cfg.Name,
		baseURL: cfg.BaseURL,
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		rateLimiter: newRateLimiter(rateLimit),
		logger:      logger,
	}
}

// doRequest performs an HTTP request and returns raw response
func (f *FixtureFetcher) doRequest(ctx context.Context, url string) (json.RawMessage, error) {
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
func (f *FixtureFetcher) GetLatestBlockNumber(ctx context.Context) (uint64, error) {
	url := fmt.Sprintf("%s&module=proxy&action=eth_blockNumber&apikey=%s", f.baseURL, f.apiKey)

	body, err := f.doRequest(ctx, url)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Result string `json:"result"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, fmt.Errorf("unmarshal response: %w", err)
	}

	blockNumber, err := strconv.ParseUint(resp.Result, 0, 64)
	if err != nil {
		return 0, fmt.Errorf("parse block number: %w", err)
	}

	return blockNumber, nil
}

// FetchBlock fetches a block and optionally its internal transactions
func (f *FixtureFetcher) FetchBlock(ctx context.Context, blockNum uint64, includeInternalTxs bool) (*BlockFixture, error) {
	// Fetch block
	url := fmt.Sprintf("%s&module=proxy&action=eth_getBlockByNumber&tag=0x%x&boolean=true&apikey=%s",
		f.baseURL, blockNum, f.apiKey)

	blockResp, err := f.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch block: %w", err)
	}

	fixture := &BlockFixture{
		Network:       f.network,
		BlockNumber:   blockNum,
		FetchedAt:     time.Now().UTC().Format(time.RFC3339),
		BlockResponse: blockResp,
		InternalTxs:   make(map[string]json.RawMessage),
	}

	// Extract transaction hashes and fetch internal txs
	if includeInternalTxs {
		var block struct {
			Result struct {
				Transactions []struct {
					Hash string `json:"hash"`
				} `json:"transactions"`
			} `json:"result"`
		}
		if err := json.Unmarshal(blockResp, &block); err == nil {
			for _, tx := range block.Result.Transactions {
				internalResp, err := f.FetchInternalTransactions(ctx, tx.Hash)
				if err != nil {
					f.logger.Warn("Failed to fetch internal txs",
						zap.String("hash", tx.Hash),
						zap.Error(err))
					continue
				}
				fixture.InternalTxs[tx.Hash] = internalResp
			}
		}
	}

	return fixture, nil
}

// FetchInternalTransactions fetches internal transactions for a tx hash
func (f *FixtureFetcher) FetchInternalTransactions(ctx context.Context, txHash string) (json.RawMessage, error) {
	url := fmt.Sprintf("%s&module=account&action=txlistinternal&txhash=%s&apikey=%s",
		f.baseURL, txHash, f.apiKey)

	return f.doRequest(ctx, url)
}

// FetchAddressTransactions fetches transactions for an address
func (f *FixtureFetcher) FetchAddressTransactions(ctx context.Context, address string, startBlock, endBlock uint64) (*AddressFixture, error) {
	url := fmt.Sprintf("%s&module=account&action=txlist&address=%s&startblock=%d&endblock=%d&sort=asc&apikey=%s",
		f.baseURL, address, startBlock, endBlock, f.apiKey)

	resp, err := f.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch address txs: %w", err)
	}

	return &AddressFixture{
		Network:        f.network,
		Address:        address,
		StartBlock:     startBlock,
		EndBlock:       endBlock,
		FetchedAt:      time.Now().UTC().Format(time.RFC3339),
		TxListResponse: resp,
	}, nil
}

// FetchTokenTransfers fetches ERC20 token transfers for an address
func (f *FixtureFetcher) FetchTokenTransfers(ctx context.Context, address string, startBlock, endBlock uint64) (json.RawMessage, error) {
	url := fmt.Sprintf("%s&module=account&action=tokentx&address=%s&startblock=%d&endblock=%d&sort=asc&apikey=%s",
		f.baseURL, address, startBlock, endBlock, f.apiKey)

	return f.doRequest(ctx, url)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
