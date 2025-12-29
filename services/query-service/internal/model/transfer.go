package model

import (
	"database/sql"
	"time"
)

// Transfer represents a token transfer record
type Transfer struct {
	ID            int64          `gorm:"primaryKey;column:id" json:"id"`
	TxHash        string         `gorm:"column:tx_hash;size:66;not null" json:"txHash"`
	BlockNumber   int64          `gorm:"column:block_number;not null;index" json:"blockNumber"`
	LogIndex      int            `gorm:"column:log_index;not null;default:0" json:"logIndex"`
	FromAddress   string         `gorm:"column:from_address;size:42;not null;index" json:"fromAddress"`
	ToAddress     string         `gorm:"column:to_address;size:42;not null;index" json:"toAddress"`
	Value         string         `gorm:"column:value;type:numeric(78,0);not null" json:"value"`
	TokenAddress  sql.NullString `gorm:"column:token_address;size:42" json:"tokenAddress,omitempty"`
	TokenSymbol   sql.NullString `gorm:"column:token_symbol;size:20" json:"tokenSymbol,omitempty"`
	TokenDecimal  sql.NullInt32  `gorm:"column:token_decimal" json:"tokenDecimal,omitempty"`
	Timestamp     time.Time      `gorm:"column:timestamp;not null;index" json:"timestamp"`
	TransferType  string         `gorm:"column:transfer_type;size:20;not null;default:native" json:"transferType"`
	Network       string         `gorm:"column:network;size:20;not null;default:ethereum;index" json:"network"`
	CreatedAt     time.Time      `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

// TableName specifies the table name for Transfer
func (Transfer) TableName() string {
	return "chain_data.transfers"
}

// TransferResponse is the API response format for Transfer
type TransferResponse struct {
	ID           int64   `json:"id"`
	TxHash       string  `json:"txHash"`
	BlockNumber  int64   `json:"blockNumber"`
	LogIndex     int     `json:"logIndex"`
	FromAddress  string  `json:"fromAddress"`
	ToAddress    string  `json:"toAddress"`
	Value        string  `json:"value"`
	TokenAddress *string `json:"tokenAddress,omitempty"`
	TokenSymbol  *string `json:"tokenSymbol,omitempty"`
	TokenDecimal *int    `json:"tokenDecimal,omitempty"`
	Timestamp    string  `json:"timestamp"`
	TransferType string  `json:"transferType"`
	Network      string  `json:"network"`
}

// ToResponse converts Transfer to TransferResponse
func (t *Transfer) ToResponse() TransferResponse {
	resp := TransferResponse{
		ID:           t.ID,
		TxHash:       t.TxHash,
		BlockNumber:  t.BlockNumber,
		LogIndex:     t.LogIndex,
		FromAddress:  t.FromAddress,
		ToAddress:    t.ToAddress,
		Value:        t.Value,
		Timestamp:    t.Timestamp.UTC().Format(time.RFC3339),
		TransferType: t.TransferType,
		Network:      t.Network,
	}

	if t.TokenAddress.Valid {
		resp.TokenAddress = &t.TokenAddress.String
	}
	if t.TokenSymbol.Valid {
		resp.TokenSymbol = &t.TokenSymbol.String
	}
	if t.TokenDecimal.Valid {
		decimal := int(t.TokenDecimal.Int32)
		resp.TokenDecimal = &decimal
	}

	return resp
}
