package engine

import (
	"context"
	"sync"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/dedup"
	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/chain-risk-platform/alert-service/internal/repository"
	"go.uber.org/zap"
)

// AlertEngine orchestrates alert rule evaluation
type AlertEngine struct {
	registry     *EvaluatorRegistry
	ruleRepo     repository.AlertRuleRepository
	deduplicator *dedup.Deduplicator
	logger       *zap.Logger

	// Rule cache
	rulesMu       sync.RWMutex
	cachedRules   []*model.AlertRule
	rulesCachedAt time.Time
	ruleCacheTTL  time.Duration
}

// NewAlertEngine creates a new alert engine
func NewAlertEngine(
	registry *EvaluatorRegistry,
	ruleRepo repository.AlertRuleRepository,
	deduplicator *dedup.Deduplicator,
	logger *zap.Logger,
) *AlertEngine {
	return &AlertEngine{
		registry:     registry,
		ruleRepo:     ruleRepo,
		deduplicator: deduplicator,
		logger:       logger,
		ruleCacheTTL: 30 * time.Second,
	}
}

// ProcessEvent evaluates an event against all enabled rules
func (e *AlertEngine) ProcessEvent(ctx context.Context, event model.Event) ([]*model.Alert, error) {
	rules, err := e.getEnabledRules(ctx)
	if err != nil {
		return nil, err
	}

	alerts, err := e.registry.EvaluateAll(ctx, event, rules)
	if err != nil {
		return nil, err
	}

	if len(alerts) == 0 {
		return nil, nil
	}

	if e.deduplicator != nil {
		alerts, err = e.deduplicator.Filter(ctx, alerts)
		if err != nil {
			e.logger.Warn("Deduplication failed, continuing with all alerts", zap.Error(err))
		}
	}

	e.logger.Info("Processed event",
		zap.String("event_type", event.Type),
		zap.Int("rules_evaluated", len(rules)),
		zap.Int("alerts_generated", len(alerts)))

	return alerts, nil
}

// getEnabledRules retrieves enabled rules with caching
func (e *AlertEngine) getEnabledRules(ctx context.Context) ([]*model.AlertRule, error) {
	e.rulesMu.RLock()
	if e.cachedRules != nil && time.Since(e.rulesCachedAt) < e.ruleCacheTTL {
		rules := e.cachedRules
		e.rulesMu.RUnlock()
		return rules, nil
	}
	e.rulesMu.RUnlock()

	e.rulesMu.Lock()
	defer e.rulesMu.Unlock()

	if e.cachedRules != nil && time.Since(e.rulesCachedAt) < e.ruleCacheTTL {
		return e.cachedRules, nil
	}

	enabled := true
	filters := repository.AlertRuleFilters{Enabled: &enabled}
	rules, err := e.ruleRepo.List(ctx, filters)
	if err != nil {
		return nil, err
	}

	e.cachedRules = rules
	e.rulesCachedAt = time.Now()

	e.logger.Debug("Refreshed rule cache", zap.Int("rule_count", len(rules)))

	return rules, nil
}

// InvalidateRuleCache forces a rule cache refresh
func (e *AlertEngine) InvalidateRuleCache() {
	e.rulesMu.Lock()
	defer e.rulesMu.Unlock()
	e.cachedRules = nil
	e.rulesCachedAt = time.Time{}
}

// SetRuleCacheTTL sets the rule cache TTL
func (e *AlertEngine) SetRuleCacheTTL(ttl time.Duration) {
	e.ruleCacheTTL = ttl
}

// GetRegistry returns the evaluator registry
func (e *AlertEngine) GetRegistry() *EvaluatorRegistry {
	return e.registry
}

// GetDeduplicator returns the deduplicator
func (e *AlertEngine) GetDeduplicator() *dedup.Deduplicator {
	return e.deduplicator
}

// MarkAlertSent marks an alert as sent in the deduplicator
func (e *AlertEngine) MarkAlertSent(ctx context.Context, alert *model.Alert) error {
	if e.deduplicator == nil {
		return nil
	}
	return e.deduplicator.MarkSent(ctx, alert)
}
