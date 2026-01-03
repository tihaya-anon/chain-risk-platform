package parser

import (
	"encoding/json"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
)

// Parser converts raw API responses to domain models
type Parser interface {
	// ParseBlock parses raw block response to Block model
	ParseBlock(raw json.RawMessage) (*model.Block, error)

	// ParseInternalTransactions parses raw internal transactions response
	ParseInternalTransactions(raw json.RawMessage, txHash string) ([]*model.InternalTransaction, error)

	// ParseNormalTransactions parses raw normal transactions response
	ParseNormalTransactions(raw json.RawMessage) ([]*model.Transaction, error)
}
