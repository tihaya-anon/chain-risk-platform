package engine

import (
	"context"
	"sync"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

// EvaluationResult contains the result of rule evaluation
type EvaluationResult struct {
	Matched bool
	Alert   *model.Alert
}

// Evaluator evaluates events against a specific rule type
type Evaluator interface {
	// RuleType returns the rule type this evaluator handles
	RuleType() string

	// Evaluate checks if the event matches the rule conditions
	Evaluate(ctx context.Context, event model.Event, rule *model.AlertRule) (*EvaluationResult, error)
}

// EvaluatorRegistry manages all evaluators
type EvaluatorRegistry struct {
	mu         sync.RWMutex
	evaluators map[string]Evaluator
}

// NewEvaluatorRegistry creates a new evaluator registry
func NewEvaluatorRegistry() *EvaluatorRegistry {
	return &EvaluatorRegistry{
		evaluators: make(map[string]Evaluator),
	}
}

// Register adds an evaluator to the registry
func (r *EvaluatorRegistry) Register(e Evaluator) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.evaluators[e.RuleType()] = e
}

// Get returns an evaluator by rule type
func (r *EvaluatorRegistry) Get(ruleType string) (Evaluator, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.evaluators[ruleType]
	return e, ok
}

// EvaluateAll evaluates an event against all matching rules
func (r *EvaluatorRegistry) EvaluateAll(ctx context.Context, event model.Event, rules []*model.AlertRule) ([]*model.Alert, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var alerts []*model.Alert

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		evaluator, ok := r.evaluators[rule.RuleType]
		if !ok {
			continue
		}

		result, err := evaluator.Evaluate(ctx, event, rule)
		if err != nil {
			// Log error but continue with other rules
			continue
		}

		if result != nil && result.Matched && result.Alert != nil {
			alerts = append(alerts, result.Alert)
		}
	}

	return alerts, nil
}

// SupportedRuleTypes returns all registered rule types
func (r *EvaluatorRegistry) SupportedRuleTypes() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]string, 0, len(r.evaluators))
	for t := range r.evaluators {
		types = append(types, t)
	}
	return types
}
