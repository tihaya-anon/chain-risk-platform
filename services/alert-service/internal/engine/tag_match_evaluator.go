package engine

import (
	"context"
	"fmt"
	"strings"

	"github.com/chain-risk-platform/alert-service/internal/client"
	"github.com/chain-risk-platform/alert-service/internal/model"
)

// TagMatchEvaluator evaluates tag matching rules
type TagMatchEvaluator struct {
	graphClient *client.GraphServiceClient
}

// NewTagMatchEvaluator creates a new tag match evaluator
func NewTagMatchEvaluator(graphClient *client.GraphServiceClient) *TagMatchEvaluator {
	return &TagMatchEvaluator{
		graphClient: graphClient,
	}
}

// RuleType returns the rule type
func (e *TagMatchEvaluator) RuleType() string {
	return model.RuleTypeTagMatch
}

// Evaluate checks if the event matches the rule conditions
func (e *TagMatchEvaluator) Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error) {
	// Parse conditions
	conditions, err := e.parseConditions(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("parse conditions: %w", err)
	}

	// Get addresses to check based on event type
	addresses := e.extractAddresses(event)
	if len(addresses) == 0 {
		return &EvaluationResult{Matched: false}, nil
	}

	// Check each address for tag matches
	for _, address := range addresses {
		tags, err := e.getAddressTags(ctx, address)
		if err != nil {
			// Log error but continue
			continue
		}

		matched, matchedTags := e.checkTagMatch(tags, conditions)
		if matched {
			alert := e.createAlert(event, rule, address, matchedTags, conditions)
			return &EvaluationResult{Matched: true, Alert: alert}, nil
		}
	}

	return &EvaluationResult{Matched: false}, nil
}

func (e *TagMatchEvaluator) parseConditions(cond model.JSONB) (*model.TagMatchConditions, error) {
	conditions := &model.TagMatchConditions{
		MatchType: "any", // default
	}

	// Parse tags array
	if v, ok := cond["tags"].([]any); ok {
		for _, t := range v {
			if s, ok := t.(string); ok {
				conditions.Tags = append(conditions.Tags, s)
			}
		}
	} else if v, ok := cond["tags"].([]string); ok {
		conditions.Tags = v
	}

	if len(conditions.Tags) == 0 {
		return nil, fmt.Errorf("missing or empty tags")
	}

	if v, ok := cond["match_type"].(string); ok {
		conditions.MatchType = v
	}

	return conditions, nil
}

func (e *TagMatchEvaluator) extractAddresses(event model.Event) []string {
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

func (e *TagMatchEvaluator) getAddressTags(ctx context.Context, address string) ([]string, error) {
	if e.graphClient == nil {
		return nil, fmt.Errorf("graph client not configured")
	}
	return e.graphClient.GetAddressTags(ctx, address)
}

func (e *TagMatchEvaluator) checkTagMatch(addressTags []string, conditions *model.TagMatchConditions) (bool, []string) {
	// Normalize tags for comparison (case-insensitive)
	tagSet := make(map[string]bool)
	for _, t := range addressTags {
		tagSet[strings.ToLower(t)] = true
	}

	var matchedTags []string
	matchCount := 0

	for _, ruleTag := range conditions.Tags {
		if tagSet[strings.ToLower(ruleTag)] {
			matchedTags = append(matchedTags, ruleTag)
			matchCount++
		}
	}

	switch conditions.MatchType {
	case "any":
		return matchCount > 0, matchedTags
	case "all":
		return matchCount == len(conditions.Tags), matchedTags
	default:
		return matchCount > 0, matchedTags
	}
}

func (e *TagMatchEvaluator) createAlert(event model.Event, rule *model.AlertRule, address string, matchedTags []string, conditions *model.TagMatchConditions) *model.Alert {
	// Determine severity based on matched tags
	severity := e.determineSeverity(matchedTags, rule.Severity)

	title := fmt.Sprintf("Tag match detected: %s", strings.Join(matchedTags, ", "))

	var entityType, entityID string
	switch event.Type {
	case model.EventTypeTransfer:
		entityType = model.EntityTypeTransaction
		entityID = event.GetString("tx_hash")
	default:
		entityType = model.EntityTypeAddress
		entityID = address
	}

	return &model.Alert{
		RuleID:     &rule.ID,
		Type:       model.RuleTypeTagMatch,
		Severity:   severity,
		EntityType: entityType,
		EntityID:   entityID,
		Title:      title,
		Message:    e.buildMessage(address, matchedTags, conditions),
		Metadata: map[string]any{
			"address":      address,
			"matched_tags": matchedTags,
			"rule_tags":    conditions.Tags,
			"match_type":   conditions.MatchType,
		},
	}
}

func (e *TagMatchEvaluator) determineSeverity(matchedTags []string, ruleSeverity string) string {
	// Use rule severity if set
	if ruleSeverity != "" {
		return ruleSeverity
	}

	// Check for critical tags
	criticalTags := map[string]bool{
		"sanctioned": true, "ofac": true, "blacklisted": true,
	}
	highTags := map[string]bool{
		"mixer": true, "tornado cash": true, "high risk": true,
	}

	for _, tag := range matchedTags {
		lower := strings.ToLower(tag)
		if criticalTags[lower] {
			return model.SeverityCritical
		}
		if highTags[lower] {
			return model.SeverityHigh
		}
	}

	return model.SeverityMedium
}

func (e *TagMatchEvaluator) buildMessage(address string, matchedTags []string, conditions *model.TagMatchConditions) string {
	return fmt.Sprintf("Address %s matched tags: %s (rule tags: %s, match type: %s)",
		address, strings.Join(matchedTags, ", "),
		strings.Join(conditions.Tags, ", "), conditions.MatchType)
}
