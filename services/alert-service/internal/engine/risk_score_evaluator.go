package engine

import (
	"context"
	"fmt"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

// RiskScoreEvaluator evaluates risk score threshold rules
type RiskScoreEvaluator struct{}

// NewRiskScoreEvaluator creates a new risk score evaluator
func NewRiskScoreEvaluator() *RiskScoreEvaluator {
	return &RiskScoreEvaluator{}
}

// RuleType returns the rule type
func (e *RiskScoreEvaluator) RuleType() string {
	return model.RuleTypeRiskScore
}

// Evaluate checks if the event matches the rule conditions
func (e *RiskScoreEvaluator) Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error) {
	// Only process risk_score events
	if event.Type != model.EventTypeRiskScore {
		return &EvaluationResult{Matched: false}, nil
	}

	// Parse conditions
	conditions, err := e.parseConditions(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("parse conditions: %w", err)
	}

	// Get score from event
	score := event.GetFloat64("score")
	address := event.GetString("address")

	// Compare score against threshold
	if !e.compare(score, conditions.Threshold, conditions.Operator) {
		return &EvaluationResult{Matched: false}, nil
	}

	// Create alert
	alert := &model.Alert{
		RuleID:     &rule.ID,
		Type:       model.RuleTypeRiskScore,
		Severity:   e.determineSeverity(score, rule.Severity),
		EntityType: model.EntityTypeAddress,
		EntityID:   address,
		Title:      fmt.Sprintf("High risk score detected: %.2f", score),
		Message:    e.buildMessage(event, conditions),
		Metadata: map[string]interface{}{
			"score":     score,
			"threshold": conditions.Threshold,
			"operator":  conditions.Operator,
			"factors":   event.GetStringSlice("factors"),
		},
	}

	return &EvaluationResult{Matched: true, Alert: alert}, nil
}

func (e *RiskScoreEvaluator) parseConditions(cond model.JSONB) (*model.RiskScoreConditions, error) {
	conditions := &model.RiskScoreConditions{
		Operator: ">=", // default
	}

	if v, ok := cond["threshold"].(float64); ok {
		conditions.Threshold = v
	} else {
		return nil, fmt.Errorf("missing or invalid threshold")
	}

	if v, ok := cond["operator"].(string); ok {
		conditions.Operator = v
	}

	if v, ok := cond["window"].(string); ok {
		conditions.Window = v
	}

	return conditions, nil
}

func (e *RiskScoreEvaluator) compare(score, threshold float64, operator string) bool {
	switch operator {
	case ">=":
		return score >= threshold
	case ">":
		return score > threshold
	case "<=":
		return score <= threshold
	case "<":
		return score < threshold
	case "==":
		return score == threshold
	default:
		return score >= threshold
	}
}

func (e *RiskScoreEvaluator) determineSeverity(score float64, ruleSeverity string) string {
	// Use rule severity if explicitly set to critical
	if ruleSeverity == model.SeverityCritical {
		return model.SeverityCritical
	}

	// Otherwise determine by score
	switch {
	case score >= 90:
		return model.SeverityCritical
	case score >= 80:
		return model.SeverityHigh
	case score >= 60:
		return model.SeverityMedium
	default:
		return model.SeverityLow
	}
}

func (e *RiskScoreEvaluator) buildMessage(event model.Event, conditions *model.RiskScoreConditions) string {
	address := event.GetString("address")
	score := event.GetFloat64("score")
	network := event.GetString("network")
	factors := event.GetStringSlice("factors")

	msg := fmt.Sprintf("Address %s on %s has risk score %.2f (threshold: %s %.2f)",
		address, network, score, conditions.Operator, conditions.Threshold)

	if len(factors) > 0 {
		msg += fmt.Sprintf(". Risk factors: %v", factors)
	}

	return msg
}
