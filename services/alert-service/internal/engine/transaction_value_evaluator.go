package engine

import (
	"context"
	"fmt"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

// TransactionValueEvaluator evaluates large transaction rules
type TransactionValueEvaluator struct{}

// NewTransactionValueEvaluator creates a new transaction value evaluator
func NewTransactionValueEvaluator() *TransactionValueEvaluator {
	return &TransactionValueEvaluator{}
}

// RuleType returns the rule type
func (e *TransactionValueEvaluator) RuleType() string {
	return model.RuleTypeTransactionValue
}

// Evaluate checks if the event matches the rule conditions
func (e *TransactionValueEvaluator) Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error) {
	// Only process transfer events
	if event.Type != model.EventTypeTransfer {
		return &EvaluationResult{Matched: false}, nil
	}

	// Parse conditions
	conditions, err := e.parseConditions(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("parse conditions: %w", err)
	}

	// Get value from event (use USD value for comparison)
	valueUSD := event.GetFloat64("value_usd")
	txHash := event.GetString("tx_hash")
	fromAddress := event.GetString("from_address")
	toAddress := event.GetString("to_address")

	// Compare value against threshold
	if !e.compare(valueUSD, conditions.Threshold, conditions.Operator) {
		return &EvaluationResult{Matched: false}, nil
	}

	// Create alert
	alert := &model.Alert{
		RuleID:     &rule.ID,
		Type:       model.RuleTypeTransactionValue,
		Severity:   e.determineSeverity(valueUSD, rule.Severity),
		EntityType: model.EntityTypeTransaction,
		EntityID:   txHash,
		Title:      fmt.Sprintf("Large transaction detected: $%.2f", valueUSD),
		Message:    e.buildMessage(event, conditions),
		Metadata: map[string]any{
			"value_usd":    valueUSD,
			"threshold":    conditions.Threshold,
			"currency":     conditions.Currency,
			"from_address": fromAddress,
			"to_address":   toAddress,
			"token_symbol": event.GetString("token_symbol"),
		},
	}

	return &EvaluationResult{Matched: true, Alert: alert}, nil
}

func (e *TransactionValueEvaluator) parseConditions(cond model.JSONB) (*model.TransactionValueConditions, error) {
	conditions := &model.TransactionValueConditions{
		Operator: ">",   // default
		Currency: "USD", // default
	}

	if v, ok := cond["threshold"].(float64); ok {
		conditions.Threshold = v
	} else {
		return nil, fmt.Errorf("missing or invalid threshold")
	}

	if v, ok := cond["operator"].(string); ok {
		conditions.Operator = v
	}

	if v, ok := cond["currency"].(string); ok {
		conditions.Currency = v
	}

	return conditions, nil
}

func (e *TransactionValueEvaluator) compare(value, threshold float64, operator string) bool {
	switch operator {
	case ">=":
		return value >= threshold
	case ">":
		return value > threshold
	case "<=":
		return value <= threshold
	case "<":
		return value < threshold
	case "==":
		return value == threshold
	default:
		return value > threshold
	}
}

func (e *TransactionValueEvaluator) determineSeverity(valueUSD float64, ruleSeverity string) string {
	// Use rule severity if explicitly set
	if ruleSeverity != "" {
		return ruleSeverity
	}

	// Determine by value
	switch {
	case valueUSD >= 10000000: // $10M+
		return model.SeverityCritical
	case valueUSD >= 1000000: // $1M+
		return model.SeverityHigh
	case valueUSD >= 100000: // $100K+
		return model.SeverityMedium
	default:
		return model.SeverityLow
	}
}

func (e *TransactionValueEvaluator) buildMessage(event model.Event, conditions *model.TransactionValueConditions) string {
	txHash := event.GetString("tx_hash")
	fromAddress := event.GetString("from_address")
	toAddress := event.GetString("to_address")
	valueUSD := event.GetFloat64("value_usd")
	tokenSymbol := event.GetString("token_symbol")
	network := event.GetString("network")

	return fmt.Sprintf("Transaction %s on %s: %.2f %s ($%.2f USD) from %s to %s. Threshold: %s $%.2f",
		txHash, network, event.GetFloat64("value"), tokenSymbol, valueUSD,
		fromAddress, toAddress, conditions.Operator, conditions.Threshold)
}
