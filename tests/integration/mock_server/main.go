package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// MockEtherscanServer provides a mock Etherscan API server for integration testing
// It returns predefined test data to simulate blockchain data

var (
	port       = flag.Int("port", 8545, "Port to listen on")
	startBlock = flag.Uint64("start-block", 1000, "Starting block number")
	numBlocks  = flag.Int("num-blocks", 10, "Number of blocks to simulate")
)

func main() {
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/api", handleAPI)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Starting Mock Etherscan Server on %s", addr)
	log.Printf("Simulating blocks %d to %d", *startBlock, *startBlock+uint64(*numBlocks)-1)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleAPI(w http.ResponseWriter, r *http.Request) {
	module := r.URL.Query().Get("module")
	action := r.URL.Query().Get("action")

	log.Printf("Request: module=%s action=%s", module, action)

	w.Header().Set("Content-Type", "application/json")

	switch {
	case module == "proxy" && action == "eth_blockNumber":
		handleGetLatestBlockNumber(w, r)
	case module == "proxy" && action == "eth_getBlockByNumber":
		handleGetBlockByNumber(w, r)
	case module == "account" && action == "txlistinternal":
		handleGetInternalTransactions(w, r)
	default:
		http.Error(w, `{"status":"0","message":"Unknown action"}`, http.StatusBadRequest)
	}
}

func handleGetLatestBlockNumber(w http.ResponseWriter, r *http.Request) {
	latestBlock := *startBlock + uint64(*numBlocks) - 1
	response := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"result":  fmt.Sprintf("0x%x", latestBlock),
	}
	json.NewEncoder(w).Encode(response)
}

func handleGetBlockByNumber(w http.ResponseWriter, r *http.Request) {
	tag := r.URL.Query().Get("tag")
	blockNum, err := strconv.ParseUint(strings.TrimPrefix(tag, "0x"), 16, 64)
	if err != nil {
		http.Error(w, `{"error":"Invalid block number"}`, http.StatusBadRequest)
		return
	}

	// Check if block is in our simulated range
	if blockNum < *startBlock || blockNum >= *startBlock+uint64(*numBlocks) {
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  nil,
		}
		json.NewEncoder(w).Encode(response)
		return
	}

	block := generateMockBlock(blockNum)
	response := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"result":  block,
	}
	json.NewEncoder(w).Encode(response)
}

func handleGetInternalTransactions(w http.ResponseWriter, r *http.Request) {
	// Return empty internal transactions for simplicity
	response := map[string]interface{}{
		"status":  "0",
		"message": "No transactions found",
		"result":  []interface{}{},
	}
	json.NewEncoder(w).Encode(response)
}

// generateMockBlock creates a mock block with predictable test data
func generateMockBlock(blockNum uint64) map[string]interface{} {
	timestamp := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(blockNum-*startBlock) * 12 * time.Second)

	// Generate 2-5 transactions per block
	numTxs := int((blockNum % 4) + 2)
	transactions := make([]map[string]interface{}, numTxs)

	for i := 0; i < numTxs; i++ {
		transactions[i] = generateMockTransaction(blockNum, i)
	}

	return map[string]interface{}{
		"number":       fmt.Sprintf("0x%x", blockNum),
		"hash":         fmt.Sprintf("0x%064x", blockNum),
		"parentHash":   fmt.Sprintf("0x%064x", blockNum-1),
		"timestamp":    fmt.Sprintf("0x%x", timestamp.Unix()),
		"miner":        "0x0000000000000000000000000000000000000001",
		"gasUsed":      fmt.Sprintf("0x%x", 21000*numTxs),
		"gasLimit":     "0x1c9c380", // 30,000,000
		"transactions": transactions,
	}
}

// generateMockTransaction creates a mock transaction with predictable test data
func generateMockTransaction(blockNum uint64, txIndex int) map[string]interface{} {
	// Generate deterministic addresses based on block and tx index
	fromAddr := fmt.Sprintf("0x%040x", blockNum*100+uint64(txIndex))
	toAddr := fmt.Sprintf("0x%040x", blockNum*100+uint64(txIndex)+1)

	// Vary the value based on tx index (in wei)
	value := uint64((txIndex + 1) * 1000000000000000000) // 1-5 ETH

	// Some transactions are ERC20 transfers (have input data)
	var input string
	if txIndex%3 == 0 {
		// ERC20 transfer(address,uint256) - method ID: 0xa9059cbb
		recipientAddr := fmt.Sprintf("%064x", blockNum*100+uint64(txIndex)+2)
		amount := fmt.Sprintf("%064x", value)
		input = "0xa9059cbb" + recipientAddr + amount
		toAddr = "0xdAC17F958D2ee523a2206206994597C13D831ec7" // USDT contract
		value = 0                                             // No ETH value for ERC20 transfers
	} else {
		input = "0x"
	}

	return map[string]interface{}{
		"hash":             fmt.Sprintf("0x%064x", blockNum*1000+uint64(txIndex)),
		"blockNumber":      fmt.Sprintf("0x%x", blockNum),
		"blockHash":        fmt.Sprintf("0x%064x", blockNum),
		"transactionIndex": fmt.Sprintf("0x%x", txIndex),
		"from":             fromAddr,
		"to":               toAddr,
		"value":            fmt.Sprintf("0x%x", value),
		"gas":              "0x5208", // 21000
		"gasPrice":         "0x4a817c800", // 20 Gwei
		"nonce":            fmt.Sprintf("0x%x", txIndex),
		"input":            input,
	}
}
