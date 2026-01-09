package engine

import (
	"context"
	"testing"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

func TestRiskScoreEvaluator_RuleType(t *testing.T) {
	e := NewRiskScoreEvaluator()
	if e.RuleType() != model.RuleTypeRiskScore {
		t.Errorf("expected %s, got %s", model.RuleTypeRiskScore, e.RuleType())
	}
}

func TestRiskScoreEvaluator_Evaluate(t *testing.T) {
	e := NewRiskScoreEvaluator()

	tests := []struct {
		name        string
		event       model.Event
		rule        *model.AlertRule
		wantMatched bool
		wantErr     bool
	}{
		{
			name: "score above threshold triggers alert",
			event: model.Event{
				Type:      model.EventTypeRiskScore,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"address": "0x123",
					"network": "ethereum",
					"score":   85.0,
					"factors": []string{"mixer_usage"},
				},
			},
			rule: &model.AlertRule{
				ID:         1,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 80.0, "operator": ">="},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			wantMatched: true,
			wantErr:     false,
		},
		{
			name: "score below threshold no alert",
			event: model.Event{
				Type:      model.EventTypeRiskScore,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"address": "0x456",
					"network": "ethereum",
					"score":   70.0,
				},
			},
			rule: &model.AlertRule{
				ID:         2,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 80.0, "operator": ">="},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			wantMatched: false,
			wantErr:     false,
		},
		{
			name: "wrong event type skipped",
			event: model.Event{
				Type:      model.EventTypeTransfer,
				Timestamp: time.Now(),
				Data:      map[string]interface{}{},
			},
			rule: &model.AlertRule{
				ID:         3,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 80.0, "operator": ">="},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			wantMatched: false,
			wantErr:     false,
		},
		{
			name: "greater than operator",
			event: model.Event{
				Type:      model.EventTypeRiskScore,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"address": "0x789",
					"score":   80.0,
				},
			},
			rule: &model.AlertRule{
				ID:         4,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 80.0, "operator": ">"},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			wantMatched: false, // 80 is not > 80
			wantErr:     false,
		},
		{
			name: "critical severity for score >= 90",
			event: model.Event{
				Type:      model.EventTypeRiskScore,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"address": "0xabc",
					"score":   95.0,
				},
			},
			rule: &model.AlertRule{
				ID:         5,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 90.0, "operator": ">="},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			wantMatched: true,
			wantErr:     false,
		},
		{
			name: "missing threshold returns error",
			event: model.Event{
				Type:      model.EventTypeRiskScore,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"address": "0xdef",
					"score":   85.0,
				},
			},
			rule: &model.AlertRule{
				ID:         6,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"operator": ">="},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			wantMatched: false,
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := e.Evaluate(context.Background(), tt.event, tt.rule)

			if (err != nil) != tt.wantErr {
				t.Errorf("Evaluate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if err != nil {
				return
			}

			if result.Matched != tt.wantMatched {
				t.Errorf("Evaluate() matched = %v, want %v", result.Matched, tt.wantMatched)
			}

			if tt.wantMatched && result.Alert == nil {
				t.Error("Evaluate() alert is nil when matched")
			}

			if tt.wantMatched && result.Alert != nil {
				if result.Alert.EntityID == "" {
					t.Error("Alert entity ID is empty")
				}
				if result.Alert.Type != model.RuleTypeRiskScore {
					t.Errorf("Alert type = %s, want %s", result.Alert.Type, model.RuleTypeRiskScore)
				}
			}
		})
	}
}

func TestTransactionValueEvaluator_RuleType(t *testing.T) {
	e := NewTransactionValueEvaluator()
	if e.RuleType() != model.RuleTypeTransactionValue {
		t.Errorf("expected %s, got %s", model.RuleTypeTransactionValue, e.RuleType())
	}
}

func TestTransactionValueEvaluator_Evaluate(t *testing.T) {
	e := NewTransactionValueEvaluator()

	tests := []struct {
		name        string
		event       model.Event
		rule        *model.AlertRule
		wantMatched bool
		wantErr     bool
	}{
		{
			name: "large transaction triggers alert",
			event: model.Event{
				Type:      model.EventTypeTransfer,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"tx_hash":      "0xabc123",
					"from_address": "0x111",
					"to_address":   "0x222",
					"value":        "1000",
					"value_usd":    1500000.0,
					"token_symbol": "ETH",
					"network":      "ethereum",
				},
			},
			rule: &model.AlertRule{
				ID:         1,
				RuleType:   model.RuleTypeTransactionValue,
				Conditions: model.JSONB{"threshold": 1000000.0, "operator": ">", "currency": "USD"},
				Severity:   model.SeverityMedium,
				Enabled:    true,
			},
			wantMatched: true,
			wantErr:     false,
		},
		{
			name: "small transaction no alert",
			event: model.Event{
				Type:      model.EventTypeTransfer,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"tx_hash":      "0xdef456",
					"from_address": "0x333",
					"to_address":   "0x444",
					"value_usd":    50000.0,
				},
			},
			rule: &model.AlertRule{
				ID:         2,
				RuleType:   model.RuleTypeTransactionValue,
				Conditions: model.JSONB{"threshold": 1000000.0, "operator": ">"},
				Severity:   model.SeverityMedium,
				Enabled:    true,
			},
			wantMatched: false,
			wantErr:     false,
		},
		{
			name: "wrong event type skipped",
			event: model.Event{
				Type:      model.EventTypeRiskScore,
				Timestamp: time.Now(),
				Data:      map[string]interface{}{},
			},
			rule: &model.AlertRule{
				ID:         3,
				RuleType:   model.RuleTypeTransactionValue,
				Conditions: model.JSONB{"threshold": 1000000.0},
				Severity:   model.SeverityMedium,
				Enabled:    true,
			},
			wantMatched: false,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := e.Evaluate(context.Background(), tt.event, tt.rule)

			if (err != nil) != tt.wantErr {
				t.Errorf("Evaluate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if err != nil {
				return
			}

			if result.Matched != tt.wantMatched {
				t.Errorf("Evaluate() matched = %v, want %v", result.Matched, tt.wantMatched)
			}
		})
	}
}

func TestEvaluatorRegistry(t *testing.T) {
	registry := NewEvaluatorRegistry()

	// Register evaluators
	registry.Register(NewRiskScoreEvaluator())
	registry.Register(NewTransactionValueEvaluator())

	// Test Get
	t.Run("get existing evaluator", func(t *testing.T) {
		e, ok := registry.Get(model.RuleTypeRiskScore)
		if !ok {
			t.Error("expected to find risk_score evaluator")
		}
		if e == nil {
			t.Error("evaluator is nil")
		}
	})

	t.Run("get non-existing evaluator", func(t *testing.T) {
		_, ok := registry.Get("unknown_type")
		if ok {
			t.Error("expected not to find unknown evaluator")
		}
	})

	// Test SupportedRuleTypes
	t.Run("supported rule types", func(t *testing.T) {
		types := registry.SupportedRuleTypes()
		if len(types) != 2 {
			t.Errorf("expected 2 types, got %d", len(types))
		}
	})

	// Test EvaluateAll
	t.Run("evaluate all rules", func(t *testing.T) {
		event := model.Event{
			Type:      model.EventTypeRiskScore,
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"address": "0x123",
				"score":   85.0,
			},
		}

		rules := []*model.AlertRule{
			{
				ID:         1,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 80.0, "operator": ">="},
				Severity:   model.SeverityHigh,
				Enabled:    true,
			},
			{
				ID:         2,
				RuleType:   model.RuleTypeRiskScore,
				Conditions: model.JSONB{"threshold": 90.0, "operator": ">="},
				Severity:   model.SeverityCritical,
				Enabled:    true,
			},
		}

		alerts, err := registry.EvaluateAll(context.Background(), event, rules)
		if err != nil {
			t.Errorf("EvaluateAll() error = %v", err)
		}

		// Should match first rule (85 >= 80) but not second (85 < 90)
		if len(alerts) != 1 {
			t.Errorf("expected 1 alert, got %d", len(alerts))
		}
	})
}
