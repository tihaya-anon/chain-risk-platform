package parser

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
)

// EtherscanParser implements Parser for Etherscan-compatible APIs
type EtherscanParser struct{}

// NewEtherscanParser creates a new Etherscan parser
func NewEtherscanParser() *EtherscanParser {
	return &EtherscanParser{}
}

// ParseBlock parses raw block response to Block model
func (p *EtherscanParser) ParseBlock(raw json.RawMessage) (*model.Block, error) {
	var resp struct {
		Result *ethBlock `json:"result"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if resp.Result == nil {
		return nil, fmt.Errorf("block result is null")
	}

	return resp.Result.ToModel(), nil
}

// ParseInternalTransactions parses raw internal transactions response
func (p *EtherscanParser) ParseInternalTransactions(raw json.RawMessage, txHash string) ([]*model.InternalTransaction, error) {
	var resp struct {
		Status  string          `json:"status"`
		Message string          `json:"message"`
		Result  json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
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

// ParseNormalTransactions parses raw normal transactions response
func (p *EtherscanParser) ParseNormalTransactions(raw json.RawMessage) ([]*model.Transaction, error) {
	var resp struct {
		Status  string          `json:"status"`
		Message string          `json:"message"`
		Result  json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
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
