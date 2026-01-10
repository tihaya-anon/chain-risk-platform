package generator

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
)

// RandomGenerator generates random blockchain data
type RandomGenerator struct {
	network string
	logger  *zap.Logger
}

// NewRandomGenerator creates a new random generator
func NewRandomGenerator(network string, logger *zap.Logger) *RandomGenerator {
	return &RandomGenerator{
		network: network,
		logger:  logger,
	}
}

// Generate generates a random block with transactions
// Output format matches Etherscan API: { "id": 1, "jsonrpc": "2.0", "result": { block fields... } }
func (g *RandomGenerator) Generate(blockNumber uint64) (*producer.RawBlockData, error) {
	txCount := g.randomInt(1, 10)
	txs := g.generateTransactions(txCount)

	block := g.buildBlock(blockNumber, txs)

	// Wrap in Etherscan API format
	apiResponse := map[string]interface{}{
		"id":      1,
		"jsonrpc": "2.0",
		"result":  block,
	}

	rawBlock, err := json.Marshal(apiResponse)
	if err != nil {
		return nil, fmt.Errorf("marshal block: %w", err)
	}

	return &producer.RawBlockData{
		Network:     g.network,
		BlockNumber: blockNumber,
		Timestamp:   g.randomTimestamp(),
		RawBlock:    rawBlock,
	}, nil
}

func (g *RandomGenerator) buildBlock(blockNumber uint64, transactions []map[string]interface{}) map[string]interface{} {
	blockHash := g.randomHash()

	// Update block info in transactions
	for i := range transactions {
		transactions[i]["blockHash"] = blockHash
		transactions[i]["blockNumber"] = fmt.Sprintf("0x%x", blockNumber)
		transactions[i]["transactionIndex"] = fmt.Sprintf("0x%x", i)
	}

	return map[string]interface{}{
		"number":           fmt.Sprintf("0x%x", blockNumber),
		"hash":             blockHash,
		"parentHash":       g.randomHash(),
		"nonce":            g.randomHex(8),
		"sha3Uncles":       g.randomHash(),
		"logsBloom":        g.randomHex(256),
		"transactionsRoot": g.randomHash(),
		"stateRoot":        g.randomHash(),
		"receiptsRoot":     g.randomHash(),
		"miner":            g.randomAddress(),
		"difficulty":       "0x0",
		"totalDifficulty":  "0x0",
		"extraData":        "0x",
		"size":             fmt.Sprintf("0x%x", g.randomInt(1000, 50000)),
		"gasLimit":         fmt.Sprintf("0x%x", 30000000),
		"gasUsed":          fmt.Sprintf("0x%x", g.randomInt(100000, 15000000)),
		"timestamp":        fmt.Sprintf("0x%x", time.Now().Unix()),
		"transactions":     transactions,
		"uncles":           []string{},
		"baseFeePerGas":    fmt.Sprintf("0x%x", g.randomInt(1000000000, 50000000000)),
	}
}

func (g *RandomGenerator) generateTransactions(count int) []map[string]interface{} {
	txs := make([]map[string]interface{}, count)
	for i := 0; i < count; i++ {
		from := g.randomAddress()
		to := g.randomAddress()
		value := g.randomValue()
		txs[i] = g.buildTransaction(from, to, value)
	}
	return txs
}

func (g *RandomGenerator) buildTransaction(from, to, value string) map[string]interface{} {
	return map[string]interface{}{
		"hash":                 g.randomHash(),
		"nonce":                fmt.Sprintf("0x%x", g.randomInt(0, 1000)),
		"blockHash":            "", // will be set by buildBlock
		"blockNumber":          "", // will be set by buildBlock
		"transactionIndex":     "", // will be set by buildBlock
		"from":                 from,
		"to":                   to,
		"value":                value,
		"gas":                  fmt.Sprintf("0x%x", g.randomInt(21000, 500000)),
		"gasPrice":             fmt.Sprintf("0x%x", g.randomInt(1000000000, 100000000000)),
		"input":                "0x",
		"v":                    "0x1b",
		"r":                    g.randomHash(),
		"s":                    g.randomHash(),
		"type":                 "0x2",
		"maxFeePerGas":         fmt.Sprintf("0x%x", g.randomInt(10000000000, 200000000000)),
		"maxPriorityFeePerGas": fmt.Sprintf("0x%x", g.randomInt(1000000000, 5000000000)),
	}
}

func (g *RandomGenerator) generateAddresses(count int) []string {
	addresses := make([]string, count)
	for i := 0; i < count; i++ {
		addresses[i] = g.randomAddress()
	}
	return addresses
}

func (g *RandomGenerator) randomAddress() string {
	bytes := make([]byte, 20)
	rand.Read(bytes)
	return "0x" + hex.EncodeToString(bytes)
}

func (g *RandomGenerator) randomHash() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return "0x" + hex.EncodeToString(bytes)
}

func (g *RandomGenerator) randomHex(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return "0x" + hex.EncodeToString(bytes)
}

func (g *RandomGenerator) randomValue() string {
	// Random value 0.001 - 10 ETH (in wei)
	min := new(big.Int).Mul(big.NewInt(1e15), big.NewInt(1))  // 0.001 ETH
	max := new(big.Int).Mul(big.NewInt(1e18), big.NewInt(10)) // 10 ETH
	return g.randomBigIntHex(min, max)
}

func (g *RandomGenerator) randomHighValue() string {
	// High value 10 - 100 ETH (in wei)
	min := new(big.Int).Mul(big.NewInt(1e18), big.NewInt(10))  // 10 ETH
	max := new(big.Int).Mul(big.NewInt(1e18), big.NewInt(100)) // 100 ETH
	return g.randomBigIntHex(min, max)
}

func (g *RandomGenerator) randomWhaleValue() string {
	// Whale value 100 - 10000 ETH (in wei)
	min := new(big.Int).Mul(big.NewInt(1e18), big.NewInt(100))   // 100 ETH
	max := new(big.Int).Mul(big.NewInt(1e18), big.NewInt(10000)) // 10000 ETH
	return g.randomBigIntHex(min, max)
}

func (g *RandomGenerator) randomBigIntHex(min, max *big.Int) string {
	diff := new(big.Int).Sub(max, min)
	n, _ := rand.Int(rand.Reader, diff)
	value := new(big.Int).Add(min, n)
	return fmt.Sprintf("0x%x", value)
}

func (g *RandomGenerator) randomInt(min, max int) int {
	if max <= min {
		return min
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min)))
	return min + int(n.Int64())
}

func (g *RandomGenerator) randomTimestamp() int64 {
	return time.Now().Unix()
}
