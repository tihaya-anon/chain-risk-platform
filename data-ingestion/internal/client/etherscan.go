package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
	"go.uber.org/zap"
)

// EtherscanClient implements BlockchainClient for Etherscan-compatible APIs
type EtherscanClient struct {
	network     string
	baseURL     string
	apiKey      string
	httpClient  *http.Client
	rateLimiter *rateLimiter
	logger      *zap.Logger
}

// rateLimiter implements a simple rate limiter
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

// NewEtherscanClient creates a new Etherscan client
func NewEtherscanClient(network, baseURL, apiKey string, rateLimit int) (*EtherscanClient, error) {
	logger, _ := zap.NewProduction()

	return &EtherscanClient{
		network: network,
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		rateLimiter: newRateLimiter(rateLimit),
		logger:      logger,
	}, nil
}

// Network returns the network name
func (c *EtherscanClient) Network() string {
	return c.network
}

// Close closes the client
func (c *EtherscanClient) Close() error {
	c.httpClient.CloseIdleConnections()
	return nil
}

// etherscanResponse represents the generic Etherscan API response
type etherscanResponse struct {
	Status  string          `json:"status"`
	Message string          `json:"message"`
	Result  json.RawMessage `json:"result"`
}

// doRequest performs an HTTP request with rate limiting
func (c *EtherscanClient) doRequest(ctx context.Context, url string) ([]byte, error) {
	c.rateLimiter.Wait()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
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

	return body, nil
}

// GetLatestBlockNumber returns the latest block number
func (c *EtherscanClient) GetLatestBlockNumber(ctx context.Context) (uint64, error) {
	url := fmt.Sprintf("%s&module=proxy&action=eth_blockNumber&apikey=%s", c.baseURL, c.apiKey)

	body, err := c.doRequest(ctx, url)
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
	// Etherscan returns status "0" for errors, or result contains error message
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

// GetBlockByNumber returns a block with its transactions
func (c *EtherscanClient) GetBlockByNumber(ctx context.Context, blockNumber uint64) (*model.Block, error) {
	url := fmt.Sprintf("%s&module=proxy&action=eth_getBlockByNumber&tag=0x%x&boolean=true&apikey=%s",
		c.baseURL, blockNumber, c.apiKey)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *ethBlock `json:"result"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if resp.Result == nil {
		return nil, fmt.Errorf("block not found: %d", blockNumber)
	}

	return resp.Result.ToModel(), nil
}

// ethBlock represents the Etherscan block response
type ethBlock struct {
	Number       string           `json:"number"`
	Hash         string           `json:"hash"`
	ParentHash   string           `json:"parentHash"`
	Timestamp    string           `json:"timestamp"`
	Miner        string           `json:"miner"`
	GasUsed      string           `json:"gasUsed"`
	GasLimit     string           `json:"gasLimit"`
	Transactions []ethTransaction `json:"transactions"`
}

func (b *ethBlock) ToModel() *model.Block {
	number, _ := strconv.ParseUint(b.Number, 0, 64)
	timestamp, _ := strconv.ParseInt(b.Timestamp, 0, 64)
	gasUsed, _ := strconv.ParseUint(b.GasUsed, 0, 64)
	gasLimit, _ := strconv.ParseUint(b.GasLimit, 0, 64)

	txs := make([]*model.Transaction, len(b.Transactions))
	for i, tx := range b.Transactions {
		txs[i] = tx.ToModel(time.Unix(timestamp, 0))
	}

	return &model.Block{
		Number:       number,
		Hash:         b.Hash,
		ParentHash:   b.ParentHash,
		Timestamp:    time.Unix(timestamp, 0),
		Miner:        b.Miner,
		GasUsed:      gasUsed,
		GasLimit:     gasLimit,
		Transactions: txs,
	}
}

// ethTransaction represents the Etherscan transaction response
type ethTransaction struct {
	Hash             string `json:"hash"`
	BlockNumber      string `json:"blockNumber"`
	BlockHash        string `json:"blockHash"`
	TransactionIndex string `json:"transactionIndex"`
	From             string `json:"from"`
	To               string `json:"to"`
	Value            string `json:"value"`
	Gas              string `json:"gas"`
	GasPrice         string `json:"gasPrice"`
	Nonce            string `json:"nonce"`
	Input            string `json:"input"`
}

func (t *ethTransaction) ToModel(timestamp time.Time) *model.Transaction {
	blockNumber, _ := strconv.ParseUint(t.BlockNumber, 0, 64)
	txIndex, _ := strconv.ParseUint(t.TransactionIndex, 0, 32)
	gas, _ := strconv.ParseUint(t.Gas, 0, 64)
	nonce, _ := strconv.ParseUint(t.Nonce, 0, 64)

	value := new(big.Int)
	value.SetString(t.Value, 0)

	gasPrice := new(big.Int)
	gasPrice.SetString(t.GasPrice, 0)

	return &model.Transaction{
		Hash:             t.Hash,
		BlockNumber:      blockNumber,
		BlockHash:        t.BlockHash,
		TransactionIndex: uint(txIndex),
		From:             t.From,
		To:               t.To,
		Value:            value,
		Gas:              gas,
		GasPrice:         gasPrice,
		Nonce:            nonce,
		Input:            t.Input,
		Timestamp:        timestamp,
	}
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
	url := fmt.Sprintf("%s&module=account&action=txlistinternal&txhash=%s&apikey=%s",
		c.baseURL, txHash, c.apiKey)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp etherscanResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if resp.Status != "1" {
		// No internal transactions found is not an error
		if resp.Message == "No transactions found" {
			return nil, nil
		}
		return nil, fmt.Errorf("API error: %s", resp.Message)
	}

	var internalTxs []struct {
		BlockNumber     string `json:"blockNumber"`
		From            string `json:"from"`
		To              string `json:"to"`
		Value           string `json:"value"`
		ContractAddress string `json:"contractAddress"`
		Input           string `json:"input"`
		Type            string `json:"type"`
		Gas             string `json:"gas"`
		GasUsed         string `json:"gasUsed"`
		TraceID         string `json:"traceId"`
		IsError         string `json:"isError"`
		ErrCode         string `json:"errCode"`
	}

	if err := json.Unmarshal(resp.Result, &internalTxs); err != nil {
		return nil, fmt.Errorf("unmarshal internal txs: %w", err)
	}

	result := make([]*model.InternalTransaction, len(internalTxs))
	for i, itx := range internalTxs {
		blockNum, _ := strconv.ParseUint(itx.BlockNumber, 10, 64)
		gas, _ := strconv.ParseUint(itx.Gas, 10, 64)
		gasUsed, _ := strconv.ParseUint(itx.GasUsed, 10, 64)

		value := new(big.Int)
		value.SetString(itx.Value, 10)

		result[i] = &model.InternalTransaction{
			Hash:            txHash,
			BlockNumber:     blockNum,
			From:            itx.From,
			To:              itx.To,
			Value:           value,
			ContractAddress: itx.ContractAddress,
			Input:           itx.Input,
			Type:            itx.Type,
			Gas:             gas,
			GasUsed:         gasUsed,
			TraceID:         itx.TraceID,
			IsError:         itx.IsError == "1",
			ErrCode:         itx.ErrCode,
		}
	}

	return result, nil
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
	url := fmt.Sprintf("%s&module=account&action=txlist&address=%s&startblock=%d&endblock=%d&sort=asc&apikey=%s",
		c.baseURL, address, startBlock, endBlock, c.apiKey)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp etherscanResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if resp.Status != "1" {
		if resp.Message == "No transactions found" {
			return nil, nil
		}
		return nil, fmt.Errorf("API error: %s", resp.Message)
	}

	var txs []struct {
		Hash             string `json:"hash"`
		BlockNumber      string `json:"blockNumber"`
		BlockHash        string `json:"blockHash"`
		TransactionIndex string `json:"transactionIndex"`
		From             string `json:"from"`
		To               string `json:"to"`
		Value            string `json:"value"`
		Gas              string `json:"gas"`
		GasPrice         string `json:"gasPrice"`
		GasUsed          string `json:"gasUsed"`
		Nonce            string `json:"nonce"`
		Input            string `json:"input"`
		TimeStamp        string `json:"timeStamp"`
		IsError          string `json:"isError"`
		TxReceiptStatus  string `json:"txreceipt_status"`
		ContractAddress  string `json:"contractAddress"`
	}

	if err := json.Unmarshal(resp.Result, &txs); err != nil {
		return nil, fmt.Errorf("unmarshal transactions: %w", err)
	}

	result := make([]*model.Transaction, len(txs))
	for i, tx := range txs {
		blockNum, _ := strconv.ParseUint(tx.BlockNumber, 10, 64)
		txIndex, _ := strconv.ParseUint(tx.TransactionIndex, 10, 32)
		gas, _ := strconv.ParseUint(tx.Gas, 10, 64)
		gasUsed, _ := strconv.ParseUint(tx.GasUsed, 10, 64)
		nonce, _ := strconv.ParseUint(tx.Nonce, 10, 64)
		timestamp, _ := strconv.ParseInt(tx.TimeStamp, 10, 64)

		value := new(big.Int)
		value.SetString(tx.Value, 10)

		gasPrice := new(big.Int)
		gasPrice.SetString(tx.GasPrice, 10)

		result[i] = &model.Transaction{
			Hash:             tx.Hash,
			BlockNumber:      blockNum,
			BlockHash:        tx.BlockHash,
			TransactionIndex: uint(txIndex),
			From:             tx.From,
			To:               tx.To,
			Value:            value,
			Gas:              gas,
			GasPrice:         gasPrice,
			GasUsed:          gasUsed,
			Nonce:            nonce,
			Input:            tx.Input,
			Timestamp:        time.Unix(timestamp, 0),
			IsError:          tx.IsError == "1",
			TxReceiptStatus:  tx.TxReceiptStatus,
			ContractAddress:  tx.ContractAddress,
		}
	}

	return result, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
