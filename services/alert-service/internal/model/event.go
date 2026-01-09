package model

import "time"

// RiskScoreEvent represents an event from risk-scores Kafka topic
type RiskScoreEvent struct {
	Address   string    `json:"address"`
	Network   string    `json:"network"`
	Score     float64   `json:"score"`
	Factors   []string  `json:"factors,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// TransferEvent represents an event from transfers Kafka topic
type TransferEvent struct {
	TxHash      string  `json:"tx_hash"`
	FromAddress string  `json:"from_address"`
	ToAddress   string  `json:"to_address"`
	Value       string  `json:"value"`
	ValueUSD    float64 `json:"value_usd"`
	TokenSymbol string  `json:"token_symbol"`
	Network     string  `json:"network"`
	BlockNumber int64   `json:"block_number"`
	Timestamp   int64   `json:"timestamp"`
}

// ToEvent converts RiskScoreEvent to generic Event for evaluation
func (e *RiskScoreEvent) ToEvent() Event {
	return Event{
		Type:      EventTypeRiskScore,
		Timestamp: e.Timestamp,
		Data: map[string]interface{}{
			"address": e.Address,
			"network": e.Network,
			"score":   e.Score,
			"factors": e.Factors,
		},
	}
}

// ToEvent converts TransferEvent to generic Event for evaluation
func (e *TransferEvent) ToEvent() Event {
	return Event{
		Type:      EventTypeTransfer,
		Timestamp: time.Unix(e.Timestamp, 0),
		Data: map[string]interface{}{
			"tx_hash":      e.TxHash,
			"from_address": e.FromAddress,
			"to_address":   e.ToAddress,
			"value":        e.Value,
			"value_usd":    e.ValueUSD,
			"token_symbol": e.TokenSymbol,
			"network":      e.Network,
			"block_number": e.BlockNumber,
		},
	}
}

// Event represents a generic event for rule evaluation
type Event struct {
	Type      string
	Timestamp time.Time
	Data      map[string]interface{}
}

// Event type constants
const (
	EventTypeRiskScore = "risk_score"
	EventTypeTransfer  = "transfer"
)

// GetString extracts a string value from event data
func (e *Event) GetString(key string) string {
	if v, ok := e.Data[key].(string); ok {
		return v
	}
	return ""
}

// GetFloat64 extracts a float64 value from event data
func (e *Event) GetFloat64(key string) float64 {
	switch v := e.Data[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case int64:
		return float64(v)
	default:
		return 0
	}
}

// GetInt64 extracts an int64 value from event data
func (e *Event) GetInt64(key string) int64 {
	switch v := e.Data[key].(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return 0
	}
}

// GetStringSlice extracts a string slice from event data
func (e *Event) GetStringSlice(key string) []string {
	if v, ok := e.Data[key].([]string); ok {
		return v
	}
	if v, ok := e.Data[key].([]interface{}); ok {
		result := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	}
	return nil
}
