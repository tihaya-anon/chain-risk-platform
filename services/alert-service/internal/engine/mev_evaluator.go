package engine

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

// MevEvaluator evaluates MEV events against rules
type MevEvaluator struct{}

// NewMevEvaluator creates a new MEV evaluator
func NewMevEvaluator() *MevEvaluator {
	return &MevEvaluator{}
}

// RuleType returns the rule types this evaluator handles
func (e *MevEvaluator) RuleType() string {
	return "mev" // Generic MEV type, handles all MEV subtypes
}

// Evaluate checks if the MEV event matches the rule conditions
func (e *MevEvaluator) Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error) {
	if event.Type != model.EventTypeMev {
		return nil, nil
	}

	// Parse conditions
	var conditions model.MevConditions
	condBytes, err := json.Marshal(rule.Conditions)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(condBytes, &conditions); err != nil {
		return nil, err
	}

	alertType := event.GetString("alert_type")
	severity := event.GetString("severity")

	// Filter by alert types if specified
	if len(conditions.AlertTypes) > 0 {
		matched := false
		for _, t := range conditions.AlertTypes {
			if strings.EqualFold(t, alertType) {
				matched = true
				break
			}
		}
		if !matched {
			return &EvaluationResult{Matched: false}, nil
		}
	}

	// Filter by minimum severity
	if conditions.MinSeverity != "" {
		if !severityMeetsMinimum(severity, conditions.MinSeverity) {
			return &EvaluationResult{Matched: false}, nil
		}
	}

	// Filter by target contracts
	if len(conditions.TargetContracts) > 0 {
		targetContract := event.GetString("target_contract")
		matched := false
		for _, c := range conditions.TargetContracts {
			if strings.EqualFold(c, targetContract) {
				matched = true
				break
			}
		}
		if !matched {
			return &EvaluationResult{Matched: false}, nil
		}
	}

	// Build alert
	alert := buildMevAlert(event, rule)

	return &EvaluationResult{
		Matched: true,
		Alert:   alert,
	}, nil
}

func severityMeetsMinimum(actual, minimum string) bool {
	severityOrder := map[string]int{
		model.SeverityLow:      1,
		model.SeverityMedium:   2,
		model.SeverityHigh:     3,
		model.SeverityCritical: 4,
	}

	actualLevel := severityOrder[strings.ToLower(actual)]
	minLevel := severityOrder[strings.ToLower(minimum)]

	return actualLevel >= minLevel
}

func buildMevAlert(event model.Event, rule *model.AlertRule) *model.Alert {
	alertType := event.GetString("alert_type")
	attackerAddr := event.GetString("attacker_address")
	
	title := formatMevTitle(alertType, attackerAddr)
	message := formatMevMessage(event)

	return &model.Alert{
		RuleID:     &rule.ID,
		Type:       alertType,
		Severity:   event.GetString("severity"),
		EntityType: model.EntityTypeMev,
		EntityID:   event.GetString("alert_id"),
		Title:      title,
		Message:    message,
		Metadata:   event.Data,
	}
}

func formatMevTitle(alertType, attacker string) string {
	shortAddr := attacker
	if len(attacker) > 10 {
		shortAddr = attacker[:6] + "..." + attacker[len(attacker)-4:]
	}
	
	switch alertType {
	case model.MevAlertTypeSandwich:
		return "Sandwich Attack: " + shortAddr
	case model.MevAlertTypeFrontRun:
		return "Front-Run: " + shortAddr
	case model.MevAlertTypeAbnormalGas:
		return "Abnormal Gas: " + shortAddr
	default:
		return "MEV Alert: " + shortAddr
	}
}

func formatMevMessage(event model.Event) string {
	alertType := event.GetString("alert_type")
	attacker := event.GetString("attacker_address")
	victim := event.GetString("victim_address")
	gasDiff := event.GetString("gas_price_diff")
	
	switch alertType {
	case model.MevAlertTypeSandwich:
		return "Sandwich attack from " + attacker + " targeting " + victim
	case model.MevAlertTypeFrontRun:
		return "Front-run from " + attacker + " targeting " + victim + " (gas diff: " + gasDiff + ")"
	case model.MevAlertTypeAbnormalGas:
		return "Abnormal gas price from " + attacker + " (diff: " + gasDiff + ")"
	default:
		return "MEV activity detected: " + event.GetString("alert_id")
	}
}
