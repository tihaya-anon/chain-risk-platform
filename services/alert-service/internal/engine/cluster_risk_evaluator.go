package engine

import (
	"context"
	"fmt"

	"github.com/chain-risk-platform/alert-service/internal/client"
	"github.com/chain-risk-platform/alert-service/internal/model"
)

// ClusterRiskEvaluator evaluates cluster-level risk rules
type ClusterRiskEvaluator struct {
	graphClient *client.GraphServiceClient
}

// NewClusterRiskEvaluator creates a new cluster risk evaluator
func NewClusterRiskEvaluator(graphClient *client.GraphServiceClient) *ClusterRiskEvaluator {
	return &ClusterRiskEvaluator{
		graphClient: graphClient,
	}
}

// RuleType returns the rule type
func (e *ClusterRiskEvaluator) RuleType() string {
	return model.RuleTypeClusterRisk
}

// ClusterRiskConditions represents cluster risk rule conditions
type ClusterRiskConditions struct {
	Threshold    float64 `json:"threshold"`
	Operator     string  `json:"operator"`
	MinAddresses int     `json:"min_addresses"` // Minimum cluster size
}

// Evaluate checks if the event matches the rule conditions
func (e *ClusterRiskEvaluator) Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error) {
	if e.graphClient == nil {
		return &EvaluationResult{Matched: false}, nil
	}

	// Parse conditions
	conditions, err := e.parseConditions(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("parse conditions: %w", err)
	}

	// Get addresses to check
	addresses := e.extractAddresses(event)
	if len(addresses) == 0 {
		return &EvaluationResult{Matched: false}, nil
	}

	// Check cluster risk for each address
	for _, address := range addresses {
		cluster, err := e.graphClient.GetClusterByAddress(ctx, address)
		if err != nil || cluster == nil {
			continue
		}

		// Check minimum cluster size
		if conditions.MinAddresses > 0 && cluster.AddressCount < conditions.MinAddresses {
			continue
		}

		// Compare cluster risk score
		if e.compare(cluster.RiskScore, conditions.Threshold, conditions.Operator) {
			alert := e.createAlert(event, rule, address, cluster, conditions)
			return &EvaluationResult{Matched: true, Alert: alert}, nil
		}
	}

	return &EvaluationResult{Matched: false}, nil
}

func (e *ClusterRiskEvaluator) parseConditions(cond model.JSONB) (*ClusterRiskConditions, error) {
	conditions := &ClusterRiskConditions{
		Operator:     ">=",
		MinAddresses: 0,
	}

	if v, ok := cond["threshold"].(float64); ok {
		conditions.Threshold = v
	} else {
		return nil, fmt.Errorf("missing or invalid threshold")
	}

	if v, ok := cond["operator"].(string); ok {
		conditions.Operator = v
	}

	if v, ok := cond["min_addresses"].(float64); ok {
		conditions.MinAddresses = int(v)
	}

	return conditions, nil
}

func (e *ClusterRiskEvaluator) extractAddresses(event model.Event) []string {
	var addresses []string

	switch event.Type {
	case model.EventTypeRiskScore:
		if addr := event.GetString("address"); addr != "" {
			addresses = append(addresses, addr)
		}
	case model.EventTypeTransfer:
		if from := event.GetString("from_address"); from != "" {
			addresses = append(addresses, from)
		}
		if to := event.GetString("to_address"); to != "" {
			addresses = append(addresses, to)
		}
	}

	return addresses
}

func (e *ClusterRiskEvaluator) compare(score, threshold float64, operator string) bool {
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

func (e *ClusterRiskEvaluator) createAlert(event model.Event, rule *model.AlertRule, address string, cluster *client.ClusterRiskResponse, conditions *ClusterRiskConditions) *model.Alert {
	return &model.Alert{
		RuleID:     &rule.ID,
		Type:       model.RuleTypeClusterRisk,
		Severity:   e.determineSeverity(cluster.RiskScore, rule.Severity),
		EntityType: model.EntityTypeCluster,
		EntityID:   cluster.ClusterID,
		Title:      fmt.Sprintf("High risk cluster detected: %.2f", cluster.RiskScore),
		Message:    e.buildMessage(address, cluster, conditions),
		Metadata: map[string]interface{}{
			"cluster_id":     cluster.ClusterID,
			"cluster_score":  cluster.RiskScore,
			"address_count":  cluster.AddressCount,
			"cluster_tags":   cluster.Tags,
			"trigger_address": address,
			"threshold":      conditions.Threshold,
		},
	}
}

func (e *ClusterRiskEvaluator) determineSeverity(score float64, ruleSeverity string) string {
	if ruleSeverity != "" {
		return ruleSeverity
	}

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

func (e *ClusterRiskEvaluator) buildMessage(address string, cluster *client.ClusterRiskResponse, conditions *ClusterRiskConditions) string {
	return fmt.Sprintf("Address %s belongs to cluster %s with risk score %.2f (%d addresses). Threshold: %s %.2f",
		address, cluster.ClusterID, cluster.RiskScore, cluster.AddressCount,
		conditions.Operator, conditions.Threshold)
}
