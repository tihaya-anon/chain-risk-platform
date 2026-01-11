package service

import (
	"context"
	"fmt"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/engine"
	"github.com/chain-risk-platform/alert-service/internal/kafka"
	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/chain-risk-platform/alert-service/internal/notifier"
	"github.com/chain-risk-platform/alert-service/internal/repository"
	"go.uber.org/zap"
)

// AlertService provides alert business logic
type AlertService struct {
	ruleRepo    repository.AlertRuleRepository
	historyRepo repository.AlertHistoryRepository
	subsRepo    repository.AlertSubscriptionRepository
	engine      *engine.AlertEngine
	dispatcher  *notifier.Dispatcher
	logger      *zap.Logger
}

// NewAlertService creates a new alert service
func NewAlertService(
	ruleRepo repository.AlertRuleRepository,
	historyRepo repository.AlertHistoryRepository,
	subsRepo repository.AlertSubscriptionRepository,
	engine *engine.AlertEngine,
	dispatcher *notifier.Dispatcher,
	logger *zap.Logger,
) *AlertService {
	return &AlertService{
		ruleRepo:    ruleRepo,
		historyRepo: historyRepo,
		subsRepo:    subsRepo,
		engine:      engine,
		dispatcher:  dispatcher,
		logger:      logger,
	}
}

// HandleRiskScoreEvent implements kafka.EventHandler
func (s *AlertService) HandleRiskScoreEvent(ctx context.Context, event model.RiskScoreEvent) error {
	return s.processEvent(ctx, event.ToEvent())
}

// HandleTransferEvent implements kafka.EventHandler
func (s *AlertService) HandleTransferEvent(ctx context.Context, event model.TransferEvent) error {
	return s.processEvent(ctx, event.ToEvent())
}

// processEvent evaluates an event and sends notifications
func (s *AlertService) processEvent(ctx context.Context, event model.Event) error {
	alerts, err := s.engine.ProcessEvent(ctx, event)
	if err != nil {
		s.logger.Error("Failed to process event", zap.Error(err))
		return err
	}

	if len(alerts) == 0 {
		return nil
	}

	for _, alert := range alerts {
		if err := s.processAlert(ctx, alert); err != nil {
			s.logger.Error("Failed to process alert",
				zap.String("type", alert.Type),
				zap.Error(err))
		}
	}

	return nil
}

// processAlert saves alert history and sends notifications
func (s *AlertService) processAlert(ctx context.Context, alert *model.Alert) error {
	history := &model.AlertHistory{
		RuleID:     alert.RuleID,
		AlertType:  alert.Type,
		Severity:   alert.Severity,
		EntityType: alert.EntityType,
		EntityID:   alert.EntityID,
		Title:      alert.Title,
		Message:    alert.Message,
		Metadata:   model.JSONB(alert.Metadata),
		Status:     model.AlertStatusPending,
	}

	if err := s.historyRepo.Create(ctx, history); err != nil {
		return fmt.Errorf("create history: %w", err)
	}

	subs, err := s.subsRepo.ListByRuleID(ctx, alert.RuleID)
	if err != nil {
		s.logger.Warn("Failed to get subscriptions", zap.Error(err))
	}

	globalSubs, err := s.subsRepo.ListByRuleID(ctx, nil)
	if err != nil {
		s.logger.Warn("Failed to get global subscriptions", zap.Error(err))
	}
	subs = append(subs, globalSubs...)

	var notifyErrors []error
	if len(subs) > 0 {
		notifyErrors = s.dispatcher.SendAll(ctx, alert, subs)
	}

	now := time.Now()
	status := model.AlertStatusSent
	if len(notifyErrors) > 0 && len(notifyErrors) == len(subs) {
		status = model.AlertStatusFailed
	}

	if err := s.historyRepo.UpdateStatus(ctx, history.ID, status, &now); err != nil {
		s.logger.Error("Failed to update alert status", zap.Error(err))
	}

	if err := s.engine.MarkAlertSent(ctx, alert); err != nil {
		s.logger.Warn("Failed to mark alert sent in dedup", zap.Error(err))
	}

	s.logger.Info("Alert processed",
		zap.Int64("history_id", history.ID),
		zap.String("type", alert.Type),
		zap.String("severity", alert.Severity),
		zap.Int("subscriptions", len(subs)),
		zap.Int("errors", len(notifyErrors)))

	return nil
}

var _ kafka.EventHandler = (*AlertService)(nil)

// ---- Rule Management ----

// CreateRule creates a new alert rule
func (s *AlertService) CreateRule(ctx context.Context, rule *model.AlertRule) error {
	if err := s.ruleRepo.Create(ctx, rule); err != nil {
		return err
	}
	s.engine.InvalidateRuleCache()
	return nil
}

// GetRule retrieves a rule by ID
func (s *AlertService) GetRule(ctx context.Context, id int64) (*model.AlertRule, error) {
	return s.ruleRepo.GetByID(ctx, id)
}

// ListRules retrieves rules with filters
func (s *AlertService) ListRules(ctx context.Context, filters repository.AlertRuleFilters) ([]*model.AlertRule, error) {
	return s.ruleRepo.List(ctx, filters)
}

// UpdateRule updates an existing rule
func (s *AlertService) UpdateRule(ctx context.Context, rule *model.AlertRule) error {
	if err := s.ruleRepo.Update(ctx, rule); err != nil {
		return err
	}
	s.engine.InvalidateRuleCache()
	return nil
}

// DeleteRule deletes a rule
func (s *AlertService) DeleteRule(ctx context.Context, id int64) error {
	if err := s.ruleRepo.Delete(ctx, id); err != nil {
		return err
	}
	s.engine.InvalidateRuleCache()
	return nil
}

// SetRuleEnabled enables or disables a rule
func (s *AlertService) SetRuleEnabled(ctx context.Context, id int64, enabled bool) error {
	if err := s.ruleRepo.SetEnabled(ctx, id, enabled); err != nil {
		return err
	}
	s.engine.InvalidateRuleCache()
	return nil
}

// ---- Alert History ----

// GetAlert retrieves an alert by ID
func (s *AlertService) GetAlert(ctx context.Context, id int64) (*model.AlertHistory, error) {
	return s.historyRepo.GetByID(ctx, id)
}

// ListAlerts retrieves alert history
func (s *AlertService) ListAlerts(ctx context.Context, filters repository.AlertHistoryFilters) ([]*model.AlertHistory, error) {
	return s.historyRepo.List(ctx, filters)
}

// AcknowledgeAlert acknowledges an alert
func (s *AlertService) AcknowledgeAlert(ctx context.Context, id int64, userID string) error {
	return s.historyRepo.Acknowledge(ctx, id, userID)
}

// GetAlertStats retrieves alert statistics
func (s *AlertService) GetAlertStats(ctx context.Context, from, to time.Time) (*repository.AlertStats, error) {
	return s.historyRepo.GetStats(ctx, from, to)
}

// ---- Subscriptions ----

// CreateSubscription creates a new subscription
func (s *AlertService) CreateSubscription(ctx context.Context, sub *model.AlertSubscription) error {
	return s.subsRepo.Create(ctx, sub)
}

// GetSubscription retrieves a subscription by ID
func (s *AlertService) GetSubscription(ctx context.Context, id int64) (*model.AlertSubscription, error) {
	return s.subsRepo.GetByID(ctx, id)
}

// ListSubscriptionsByUser retrieves subscriptions for a user
func (s *AlertService) ListSubscriptionsByUser(ctx context.Context, userID string) ([]*model.AlertSubscription, error) {
	return s.subsRepo.ListByUserID(ctx, userID)
}

// DeleteSubscription deletes a subscription
func (s *AlertService) DeleteSubscription(ctx context.Context, id int64) error {
	return s.subsRepo.Delete(ctx, id)
}

// ---- Test ----

// SendTestAlert sends a test notification
func (s *AlertService) SendTestAlert(ctx context.Context, channelType string, config model.JSONB, message string) error {
	alert := &model.Alert{
		Type:       "test",
		Severity:   model.SeverityLow,
		EntityType: "test",
		EntityID:   fmt.Sprintf("test-%d", time.Now().Unix()),
		Title:      "Test Alert",
		Message:    message,
		Metadata:   map[string]any{"test": true},
	}

	return s.dispatcher.SendDirect(ctx, alert, channelType, config)
}
