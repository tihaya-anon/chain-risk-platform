package producer

import (
	"context"
	"encoding/json"
)

// RawBlockData represents raw block data fetched from blockchain API
// This is sent to Kafka for downstream processing by stream-processor
type RawBlockData struct {
	Network     string          `json:"network"`     // "ethereum", "bsc"
	BlockNumber uint64          `json:"blockNumber"` // Block number
	Timestamp   int64           `json:"timestamp"`   // Unix timestamp (seconds)
	RawBlock    json.RawMessage `json:"rawBlock"`    // Raw block JSON from API
}

// Producer defines the interface for sending raw chain data to message queue
type Producer interface {
	// SendRawBlock sends raw block data to Kafka
	// The block data is sent as-is (JSON) for downstream processing
	SendRawBlock(ctx context.Context, data *RawBlockData) error

	// SendRawBlocks sends multiple raw blocks in batch
	SendRawBlocks(ctx context.Context, blocks []*RawBlockData) error

	// Close closes the producer connection
	Close() error
}
