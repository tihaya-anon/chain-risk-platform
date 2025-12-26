package model

import (
	"math/big"
	"time"
)

// Transaction represents a blockchain transaction
type Transaction struct {
	Hash             string    `json:"hash"`
	BlockNumber      uint64    `json:"blockNumber"`
	BlockHash        string    `json:"blockHash"`
	TransactionIndex uint      `json:"transactionIndex"`
	From             string    `json:"from"`
	To               string    `json:"to"`
	Value            *big.Int  `json:"value"`
	Gas              uint64    `json:"gas"`
	GasPrice         *big.Int  `json:"gasPrice"`
	GasUsed          uint64    `json:"gasUsed"`
	Nonce            uint64    `json:"nonce"`
	Input            string    `json:"input"`
	Timestamp        time.Time `json:"timestamp"`
	IsError          bool      `json:"isError"`
	TxReceiptStatus  string    `json:"txReceiptStatus"`
	ContractAddress  string    `json:"contractAddress,omitempty"`
}

// Transfer represents a token or ETH transfer extracted from a transaction
type Transfer struct {
	TxHash       string    `json:"txHash"`
	BlockNumber  uint64    `json:"blockNumber"`
	LogIndex     uint      `json:"logIndex"`
	From         string    `json:"from"`
	To           string    `json:"to"`
	Value        *big.Int  `json:"value"`
	TokenAddress string    `json:"tokenAddress,omitempty"` // empty for native token (ETH/BNB)
	TokenSymbol  string    `json:"tokenSymbol,omitempty"`
	TokenDecimal uint8     `json:"tokenDecimal,omitempty"`
	Timestamp    time.Time `json:"timestamp"`
	TransferType string    `json:"transferType"` // "native", "erc20", "erc721", "erc1155"
}

// Block represents a blockchain block
type Block struct {
	Number       uint64         `json:"number"`
	Hash         string         `json:"hash"`
	ParentHash   string         `json:"parentHash"`
	Timestamp    time.Time      `json:"timestamp"`
	Miner        string         `json:"miner"`
	GasUsed      uint64         `json:"gasUsed"`
	GasLimit     uint64         `json:"gasLimit"`
	Transactions []*Transaction `json:"transactions"`
}

// InternalTransaction represents an internal transaction (trace)
type InternalTransaction struct {
	Hash            string   `json:"hash"`
	BlockNumber     uint64   `json:"blockNumber"`
	From            string   `json:"from"`
	To              string   `json:"to"`
	Value           *big.Int `json:"value"`
	ContractAddress string   `json:"contractAddress,omitempty"`
	Input           string   `json:"input,omitempty"`
	Type            string   `json:"type"` // call, create, suicide
	Gas             uint64   `json:"gas"`
	GasUsed         uint64   `json:"gasUsed"`
	TraceID         string   `json:"traceId"`
	IsError         bool     `json:"isError"`
	ErrCode         string   `json:"errCode,omitempty"`
}

// TokenTransfer represents an ERC20/ERC721/ERC1155 token transfer event
type TokenTransfer struct {
	TxHash          string   `json:"txHash"`
	BlockNumber     uint64   `json:"blockNumber"`
	LogIndex        uint     `json:"logIndex"`
	ContractAddress string   `json:"contractAddress"`
	From            string   `json:"from"`
	To              string   `json:"to"`
	Value           *big.Int `json:"value"`
	TokenID         *big.Int `json:"tokenId,omitempty"` // for ERC721/ERC1155
	TokenName       string   `json:"tokenName"`
	TokenSymbol     string   `json:"tokenSymbol"`
	TokenDecimal    uint8    `json:"tokenDecimal"`
	TokenType       string   `json:"tokenType"` // ERC20, ERC721, ERC1155
}

// ChainEvent is the unified event structure sent to Kafka
type ChainEvent struct {
	EventType   string      `json:"eventType"` // "transaction", "transfer", "internal_tx"
	Network     string      `json:"network"`   // "ethereum", "bsc"
	BlockNumber uint64      `json:"blockNumber"`
	Timestamp   time.Time   `json:"timestamp"`
	Data        interface{} `json:"data"`
}

// NewChainEvent creates a new ChainEvent
func NewChainEvent(eventType, network string, blockNumber uint64, timestamp time.Time, data interface{}) *ChainEvent {
	return &ChainEvent{
		EventType:   eventType,
		Network:     network,
		BlockNumber: blockNumber,
		Timestamp:   timestamp,
		Data:        data,
	}
}
