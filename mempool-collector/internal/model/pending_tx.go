package model

import (
	"encoding/json"
	"math/big"
)

// PendingTx represents a pending transaction from mempool
type PendingTx struct {
	Hash        string `json:"hash"`
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`
	Gas         uint64 `json:"gas"`
	GasPrice    string `json:"gas_price"`
	GasFeeCap   string `json:"gas_fee_cap,omitempty"`   // EIP-1559
	GasTipCap   string `json:"gas_tip_cap,omitempty"`   // EIP-1559
	Nonce       uint64 `json:"nonce"`
	Input       string `json:"input"`
	Timestamp   int64  `json:"timestamp"`
	Network     string `json:"network"`
	TxType      uint8  `json:"tx_type"`                 // 0=legacy, 2=EIP-1559
	MethodID    string `json:"method_id,omitempty"`     // first 4 bytes of input
	TokenTarget string `json:"token_target,omitempty"`  // detected token contract
}

// ToJSON serializes to JSON bytes
func (p *PendingTx) ToJSON() ([]byte, error) {
	return json.Marshal(p)
}

// ParseFromJSON deserializes from JSON bytes
func ParseFromJSON(data []byte) (*PendingTx, error) {
	var tx PendingTx
	if err := json.Unmarshal(data, &tx); err != nil {
		return nil, err
	}
	return &tx, nil
}

// GasPriceWei returns gas price as big.Int
func (p *PendingTx) GasPriceWei() *big.Int {
	val, _ := new(big.Int).SetString(p.GasPrice, 10)
	return val
}

// EffectiveGasPrice returns effective gas price for comparison
func (p *PendingTx) EffectiveGasPrice() *big.Int {
	if p.TxType == 2 && p.GasFeeCap != "" {
		val, _ := new(big.Int).SetString(p.GasFeeCap, 10)
		return val
	}
	return p.GasPriceWei()
}

// Common DEX method IDs
const (
	MethodSwapExactTokensForTokens    = "0x38ed1739"
	MethodSwapTokensForExactTokens    = "0x8803dbee"
	MethodSwapExactETHForTokens       = "0x7ff36ab5"
	MethodSwapTokensForExactETH       = "0x4a25d94a"
	MethodSwapExactTokensForETH       = "0x18cbafe5"
	MethodSwapETHForExactTokens       = "0xfb3bdb41"
	MethodMulticall                   = "0x5ae401dc"
	MethodExactInputSingle            = "0x414bf389" // Uniswap V3
	MethodExactInput                  = "0xc04b8d59"
	MethodExactOutputSingle           = "0xdb3e2198"
)

// IsDEXSwap checks if transaction is a DEX swap
func (p *PendingTx) IsDEXSwap() bool {
	if len(p.MethodID) < 10 {
		return false
	}
	switch p.MethodID[:10] {
	case MethodSwapExactTokensForTokens,
		MethodSwapTokensForExactTokens,
		MethodSwapExactETHForTokens,
		MethodSwapTokensForExactETH,
		MethodSwapExactTokensForETH,
		MethodSwapETHForExactTokens,
		MethodMulticall,
		MethodExactInputSingle,
		MethodExactInput,
		MethodExactOutputSingle:
		return true
	}
	return false
}
