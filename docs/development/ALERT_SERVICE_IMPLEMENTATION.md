# Alert Service Implementation Guide

> Complete development roadmap for Alert Service implementation

**Created**: 2026-01-09  
**Branch**: `feature/alert-service`  
**Status**: In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Tasks](#implementation-tasks)
4. [Task Details](#task-details)
5. [File Structure](#file-structure)
6. [API Specification](#api-specification)
7. [Testing Strategy](#testing-strategy)
8. [Deployment](#deployment)

---

## Overview

Alert Service is a real-time notification system that monitors blockchain transactions and addresses for risk events, triggering alerts through multiple channels.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Event Consumption** | Kafka consumer for `risk-scores` and `transfers` topics |
| **Rule Evaluation** | Flexible rule engine supporting 6 rule types |
| **Notification** | Multi-channel: Email, Webhook, Slack |
| **Deduplication** | Redis-based time window deduplication |
| **History & Audit** | PostgreSQL persistence for compliance |

### Dependencies

| Service | Purpose | Protocol |
|---------|---------|----------|
| Kafka | Event streaming | Consumer |
| PostgreSQL | Rule/history storage | SQL |
| Redis | Deduplication cache | Key-Value |
| Risk Service | Risk score queries | HTTP |
| Graph Service | Tag/cluster queries | HTTP |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Alert Service (Go/Gin)                        │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Kafka Consumer │───▶│  Alert Engine   │───▶│   Dispatcher    │  │
│  │  (risk-scores,  │    │  (Evaluator +   │    │  (Email/Webhook │  │
│  │   transfers)    │    │   Dedup)        │    │   /Slack)       │  │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘  │
│                                  │                                  │
│                                  ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      HTTP Server (Gin)                      │    │
│  │  /api/v1/alert-rules  │  /api/v1/alerts  │  /api/v1/subs    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   PostgreSQL    │    │     Redis       │    │ External APIs   │  │
│  │  (rules/history)│    │   (dedup)       │    │ (risk/graph)    │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Core Infrastructure (Tasks 1-5)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 1 | Kafka Consumer Setup | P0 | 2h |
| 2 | Event Models & Parsing | P0 | 1h |
| 3 | Service Layer Structure | P0 | 1h |
| 4 | Handler Layer Refactor | P0 | 2h |
| 5 | Wire Dependencies (main.go) | P0 | 1h |

### Phase 2: Alert Engine (Tasks 6-10)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 6 | Rule Evaluator Interface | P0 | 1h |
| 7 | RiskScore Evaluator | P0 | 2h |
| 8 | TransactionValue Evaluator | P0 | 1h |
| 9 | TagMatch Evaluator | P1 | 2h |
| 10 | Alert Engine Orchestrator | P0 | 2h |

### Phase 3: Deduplication & Persistence (Tasks 11-13)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 11 | Redis Deduplicator | P0 | 2h |
| 12 | Alert Creation Flow | P0 | 1h |
| 13 | Subscription Repository | P1 | 1h |

### Phase 4: Notification Dispatcher (Tasks 14-18)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 14 | Notifier Interface | P0 | 1h |
| 15 | Webhook Notifier | P0 | 2h |
| 16 | Email Notifier | P1 | 2h |
| 17 | Slack Notifier | P1 | 1h |
| 18 | Dispatcher with Retry | P0 | 2h |

### Phase 5: REST API (Tasks 19-24)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 19 | Alert Rules CRUD Handler | P0 | 2h |
| 20 | Alert History Handler | P0 | 2h |
| 21 | Subscription Handler | P1 | 2h |
| 22 | Stats & Dashboard API | P1 | 1h |
| 23 | Test Alert Endpoint | P1 | 1h |
| 24 | OpenAPI Documentation | P2 | 2h |

### Phase 6: Advanced Rules (Tasks 25-27)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 25 | Velocity Evaluator | P1 | 2h |
| 26 | External Service Clients | P1 | 2h |
| 27 | ClusterRisk Evaluator | P2 | 2h |

### Phase 7: Testing & Polish (Tasks 28-32)

| # | Task | Priority | Est. |
|---|------|----------|------|
| 28 | Unit Tests - Evaluators | P0 | 3h |
| 29 | Unit Tests - Notifiers | P0 | 2h |
| 30 | Integration Tests | P1 | 3h |
| 31 | Nacos Integration | P1 | 1h |
| 32 | Dockerfile & Makefile | P1 | 1h |

**Total Estimated Time**: ~48 hours

---

## Task Details

### Task 1: Kafka Consumer Setup

**File**: `internal/kafka/consumer.go`

```go
// Consumer wraps Kafka consumer with graceful shutdown
type Consumer struct {
    reader  *kafka.Reader
    handler EventHandler
    logger  *zap.Logger
}

type EventHandler interface {
    HandleRiskScore(ctx context.Context, event RiskScoreEvent) error
    HandleTransfer(ctx context.Context, event TransferEvent) error
}

func (c *Consumer) Start(ctx context.Context) error
func (c *Consumer) Stop() error
```

**Implementation Notes**:
- Use `segmentio/kafka-go` (already in go.mod)
- Subscribe to `risk-scores` and `transfers` topics
- Parse message by topic name
- Pass to appropriate handler

---

### Task 2: Event Models & Parsing

**File**: `internal/model/event.go`

```go
// RiskScoreEvent from risk-scores topic
type RiskScoreEvent struct {
    Address   string    `json:"address"`
    Network   string    `json:"network"`
    Score     float64   `json:"score"`
    Factors   []string  `json:"factors"`
    Timestamp time.Time `json:"timestamp"`
}

// TransferEvent from transfers topic
type TransferEvent struct {
    TxHash       string  `json:"tx_hash"`
    FromAddress  string  `json:"from_address"`
    ToAddress    string  `json:"to_address"`
    Value        string  `json:"value"`
    ValueUSD     float64 `json:"value_usd"`
    TokenSymbol  string  `json:"token_symbol"`
    Network      string  `json:"network"`
    BlockNumber  int64   `json:"block_number"`
    Timestamp    int64   `json:"timestamp"`
}
```

---

### Task 3: Service Layer Structure

**File**: `internal/service/alert_service.go`

```go
type AlertService struct {
    ruleRepo      repository.AlertRuleRepository
    historyRepo   repository.AlertHistoryRepository
    subsRepo      repository.AlertSubscriptionRepository
    engine        *engine.AlertEngine
    dispatcher    *notifier.Dispatcher
    logger        *zap.Logger
}

func NewAlertService(...) *AlertService
func (s *AlertService) ProcessRiskScoreEvent(ctx context.Context, event model.RiskScoreEvent) error
func (s *AlertService) ProcessTransferEvent(ctx context.Context, event model.TransferEvent) error
func (s *AlertService) CreateRule(ctx context.Context, rule *model.AlertRule) error
func (s *AlertService) ListRules(ctx context.Context, enabled *bool) ([]*model.AlertRule, error)
// ... more methods
```

---

### Task 4: Handler Layer Refactor

**File**: `internal/handler/alert_rule_handler.go`

```go
type AlertRuleHandler struct {
    service *service.AlertService
    logger  *zap.Logger
}

func NewAlertRuleHandler(service *service.AlertService, logger *zap.Logger) *AlertRuleHandler

func (h *AlertRuleHandler) RegisterRoutes() handler.RouteGroup {
    return handler.RouteGroup{
        Prefix: "/alert-rules",
        Routes: []handler.Route{
            {Method: handler.GET, Path: "", Handler: h.List},
            {Method: handler.GET, Path: "/:id", Handler: h.GetByID},
            {Method: handler.POST, Path: "", Handler: h.Create},
            {Method: handler.PUT, Path: "/:id", Handler: h.Update},
            {Method: handler.DELETE, Path: "/:id", Handler: h.Delete},
            {Method: handler.POST, Path: "/:id/enable", Handler: h.Enable},
            {Method: handler.POST, Path: "/:id/disable", Handler: h.Disable},
        },
    }
}
```

**Additional Handlers**:
- `alert_history_handler.go`
- `subscription_handler.go`
- `route.go` (copy from query-service pattern)

---

### Task 5: Wire Dependencies (main.go)

Refactor `cmd/main.go`:

```go
func main() {
    // 1. Load config
    // 2. Init logger
    // 3. Init DB, Redis
    // 4. Init repositories
    // 5. Init evaluators
    // 6. Init notifiers
    // 7. Init engine, dispatcher
    // 8. Init service
    // 9. Init handlers
    // 10. Init Kafka consumer
    // 11. Start HTTP server
    // 12. Start Kafka consumer (goroutine)
    // 13. Graceful shutdown
}
```

---

### Task 6: Rule Evaluator Interface

**File**: `internal/engine/evaluator.go`

```go
// Event represents a generic event to evaluate
type Event struct {
    Type      string                 // "risk_score", "transfer"
    Timestamp time.Time
    Data      map[string]interface{}
}

// EvaluationResult contains matched alerts
type EvaluationResult struct {
    Matched bool
    Alert   *model.Alert
}

// Evaluator evaluates events against a specific rule type
type Evaluator interface {
    // RuleType returns the rule type this evaluator handles
    RuleType() string
    
    // Evaluate checks if the event matches the rule conditions
    Evaluate(ctx context.Context, event Event, rule *model.AlertRule) (*EvaluationResult, error)
}

// EvaluatorRegistry manages all evaluators
type EvaluatorRegistry struct {
    evaluators map[string]Evaluator
}

func NewEvaluatorRegistry() *EvaluatorRegistry
func (r *EvaluatorRegistry) Register(e Evaluator)
func (r *EvaluatorRegistry) Get(ruleType string) (Evaluator, bool)
func (r *EvaluatorRegistry) EvaluateAll(ctx context.Context, event Event, rules []*model.AlertRule) ([]*model.Alert, error)
```

---

### Task 7: RiskScore Evaluator

**File**: `internal/engine/risk_score_evaluator.go`

```go
type RiskScoreEvaluator struct{}

func NewRiskScoreEvaluator() *RiskScoreEvaluator

func (e *RiskScoreEvaluator) RuleType() string {
    return model.RuleTypeRiskScore
}

func (e *RiskScoreEvaluator) Evaluate(ctx context.Context, event Event, rule *model.AlertRule) (*EvaluationResult, error) {
    // 1. Check event type is "risk_score"
    // 2. Parse conditions from rule.Conditions
    // 3. Extract score from event.Data["score"]
    // 4. Compare using operator (>=, >, <=, <, ==)
    // 5. If matched, create Alert with severity based on score
}

func (e *RiskScoreEvaluator) compare(score, threshold float64, operator string) bool {
    switch operator {
    case ">=": return score >= threshold
    case ">":  return score > threshold
    case "<=": return score <= threshold
    case "<":  return score < threshold
    case "==": return score == threshold
    default:   return false
    }
}

func (e *RiskScoreEvaluator) determineSeverity(score float64) string {
    switch {
    case score >= 90: return model.SeverityCritical
    case score >= 80: return model.SeverityHigh
    case score >= 60: return model.SeverityMedium
    default:          return model.SeverityLow
    }
}
```

---

### Task 8: TransactionValue Evaluator

**File**: `internal/engine/transaction_value_evaluator.go`

```go
type TransactionValueEvaluator struct{}

func (e *TransactionValueEvaluator) RuleType() string {
    return model.RuleTypeTransactionValue
}

func (e *TransactionValueEvaluator) Evaluate(ctx context.Context, event Event, rule *model.AlertRule) (*EvaluationResult, error) {
    // 1. Check event type is "transfer"
    // 2. Parse conditions (threshold, operator, currency)
    // 3. Extract value_usd from event.Data
    // 4. Compare against threshold
    // 5. Create Alert if matched
}
```

---

### Task 9: TagMatch Evaluator

**File**: `internal/engine/tag_match_evaluator.go`

```go
type TagMatchEvaluator struct {
    graphClient *client.GraphServiceClient
}

func (e *TagMatchEvaluator) RuleType() string {
    return model.RuleTypeTagMatch
}

func (e *TagMatchEvaluator) Evaluate(ctx context.Context, event Event, rule *model.AlertRule) (*EvaluationResult, error) {
    // 1. Extract address from event (from_address or to_address)
    // 2. Call Graph Service to get address tags
    // 3. Parse conditions (tags list, match_type: any/all)
    // 4. Check if address tags match rule tags
    // 5. Create Alert if matched
}
```

---

### Task 10: Alert Engine Orchestrator

**File**: `internal/engine/alert_engine.go`

```go
type AlertEngine struct {
    registry     *EvaluatorRegistry
    ruleRepo     repository.AlertRuleRepository
    deduplicator *dedup.Deduplicator
    logger       *zap.Logger
}

func NewAlertEngine(
    registry *EvaluatorRegistry,
    ruleRepo repository.AlertRuleRepository,
    deduplicator *dedup.Deduplicator,
    logger *zap.Logger,
) *AlertEngine

func (e *AlertEngine) ProcessEvent(ctx context.Context, event Event) ([]*model.Alert, error) {
    // 1. Load enabled rules from repository (with caching)
    // 2. Filter rules by event type compatibility
    // 3. Evaluate event against each rule
    // 4. Collect matched alerts
    // 5. Deduplicate alerts
    // 6. Return unique alerts
}
```

---

### Task 11: Redis Deduplicator

**File**: `internal/dedup/deduplicator.go`

```go
type Deduplicator struct {
    redis  *redis.Client
    window time.Duration
    logger *zap.Logger
}

func NewDeduplicator(redis *redis.Client, window time.Duration, logger *zap.Logger) *Deduplicator

func (d *Deduplicator) IsDuplicate(ctx context.Context, alert *model.Alert) (bool, error) {
    key := d.buildKey(alert)
    exists, err := d.redis.Exists(ctx, key).Result()
    return exists > 0, err
}

func (d *Deduplicator) MarkSent(ctx context.Context, alert *model.Alert) error {
    key := d.buildKey(alert)
    return d.redis.Set(ctx, key, "1", d.window).Err()
}

func (d *Deduplicator) buildKey(alert *model.Alert) string {
    // Key format: alert:dedup:{type}:{entity_type}:{entity_id}
    return fmt.Sprintf("alert:dedup:%s:%s:%s", 
        alert.Type, alert.EntityType, alert.EntityID)
}

func (d *Deduplicator) Filter(ctx context.Context, alerts []*model.Alert) ([]*model.Alert, error) {
    var filtered []*model.Alert
    for _, alert := range alerts {
        isDup, err := d.IsDuplicate(ctx, alert)
        if err != nil {
            d.logger.Warn("Dedup check failed", zap.Error(err))
            continue
        }
        if !isDup {
            filtered = append(filtered, alert)
        }
    }
    return filtered, nil
}
```

---

### Task 12: Alert Creation Flow

**File**: `internal/service/alert_service.go` (add methods)

```go
func (s *AlertService) ProcessAndNotify(ctx context.Context, alerts []*model.Alert) error {
    for _, alert := range alerts {
        // 1. Create alert history record
        history := s.alertToHistory(alert)
        if err := s.historyRepo.Create(ctx, history); err != nil {
            s.logger.Error("Failed to save alert history", zap.Error(err))
            continue
        }
        
        // 2. Get subscriptions for this rule
        subs, err := s.subsRepo.ListByRuleID(ctx, alert.RuleID)
        if err != nil {
            s.logger.Error("Failed to get subscriptions", zap.Error(err))
            continue
        }
        
        // 3. Dispatch notifications
        for _, sub := range subs {
            if err := s.dispatcher.Send(ctx, alert, sub); err != nil {
                s.logger.Error("Failed to send notification", 
                    zap.Error(err),
                    zap.String("channel", sub.ChannelType))
            }
        }
        
        // 4. Mark as sent in deduplicator
        s.engine.deduplicator.MarkSent(ctx, alert)
        
        // 5. Update history status
        now := time.Now()
        s.historyRepo.UpdateStatus(ctx, history.ID, model.AlertStatusSent, &now)
    }
    return nil
}
```

---

### Task 13: Subscription Repository

**File**: `internal/repository/alert_subscription_repository.go`

```go
type AlertSubscriptionRepository interface {
    Create(ctx context.Context, sub *model.AlertSubscription) error
    GetByID(ctx context.Context, id int64) (*model.AlertSubscription, error)
    ListByUserID(ctx context.Context, userID string) ([]*model.AlertSubscription, error)
    ListByRuleID(ctx context.Context, ruleID *int64) ([]*model.AlertSubscription, error)
    Update(ctx context.Context, sub *model.AlertSubscription) error
    Delete(ctx context.Context, id int64) error
    SetEnabled(ctx context.Context, id int64, enabled bool) error
}
```

---

### Task 14: Notifier Interface

**File**: `internal/notifier/notifier.go`

```go
// Notifier sends alert notifications via a specific channel
type Notifier interface {
    // Type returns the channel type
    Type() string
    
    // Send sends an alert notification
    Send(ctx context.Context, alert *model.Alert, config model.JSONB) error
}

// NotifierRegistry manages all notifiers
type NotifierRegistry struct {
    notifiers map[string]Notifier
}

func NewNotifierRegistry() *NotifierRegistry
func (r *NotifierRegistry) Register(n Notifier)
func (r *NotifierRegistry) Get(channelType string) (Notifier, bool)
```

---

### Task 15: Webhook Notifier

**File**: `internal/notifier/webhook.go`

```go
type WebhookNotifier struct {
    client  *http.Client
    timeout time.Duration
    logger  *zap.Logger
}

func NewWebhookNotifier(timeout time.Duration, logger *zap.Logger) *WebhookNotifier

func (n *WebhookNotifier) Type() string {
    return model.ChannelTypeWebhook
}

func (n *WebhookNotifier) Send(ctx context.Context, alert *model.Alert, config model.JSONB) error {
    // 1. Parse config (url, headers)
    url := config["url"].(string)
    headers, _ := config["headers"].(map[string]interface{})
    
    // 2. Build payload
    payload := WebhookPayload{
        AlertID:    alert.RuleID,
        Type:       alert.Type,
        Severity:   alert.Severity,
        EntityType: alert.EntityType,
        EntityID:   alert.EntityID,
        Title:      alert.Title,
        Message:    alert.Message,
        Metadata:   alert.Metadata,
        Timestamp:  time.Now().UTC(),
    }
    
    // 3. Send HTTP POST
    // 4. Handle response
}

type WebhookPayload struct {
    AlertID    *int64                 `json:"alert_id,omitempty"`
    Type       string                 `json:"type"`
    Severity   string                 `json:"severity"`
    EntityType string                 `json:"entity_type"`
    EntityID   string                 `json:"entity_id"`
    Title      string                 `json:"title"`
    Message    string                 `json:"message"`
    Metadata   map[string]interface{} `json:"metadata,omitempty"`
    Timestamp  time.Time              `json:"timestamp"`
}
```

---

### Task 16: Email Notifier

**File**: `internal/notifier/email.go`

```go
type EmailNotifier struct {
    smtpHost     string
    smtpPort     int
    smtpUser     string
    smtpPassword string
    from         string
    logger       *zap.Logger
}

func NewEmailNotifier(cfg config.EmailConfig, logger *zap.Logger) *EmailNotifier

func (n *EmailNotifier) Type() string {
    return model.ChannelTypeEmail
}

func (n *EmailNotifier) Send(ctx context.Context, alert *model.Alert, config model.JSONB) error {
    // 1. Parse config (email address)
    to := config["email"].(string)
    
    // 2. Build email content
    subject := fmt.Sprintf("[%s] %s", strings.ToUpper(alert.Severity), alert.Title)
    body := n.buildEmailBody(alert)
    
    // 3. Send via SMTP
}

func (n *EmailNotifier) buildEmailBody(alert *model.Alert) string {
    // HTML or plain text template
}
```

---

### Task 17: Slack Notifier

**File**: `internal/notifier/slack.go`

```go
type SlackNotifier struct {
    client  *http.Client
    timeout time.Duration
    logger  *zap.Logger
}

func NewSlackNotifier(timeout time.Duration, logger *zap.Logger) *SlackNotifier

func (n *SlackNotifier) Type() string {
    return model.ChannelTypeSlack
}

func (n *SlackNotifier) Send(ctx context.Context, alert *model.Alert, config model.JSONB) error {
    webhookURL := config["webhook_url"].(string)
    
    // Build Slack message with blocks
    msg := SlackMessage{
        Blocks: []SlackBlock{
            {
                Type: "header",
                Text: &SlackText{Type: "plain_text", Text: alert.Title},
            },
            {
                Type: "section",
                Text: &SlackText{Type: "mrkdwn", Text: n.formatMessage(alert)},
            },
        },
    }
    
    // Send to webhook URL
}

func (n *SlackNotifier) severityEmoji(severity string) string {
    switch severity {
    case model.SeverityCritical: return "🔴"
    case model.SeverityHigh:     return "🟠"
    case model.SeverityMedium:   return "🟡"
    default:                      return "🟢"
    }
}
```

---

### Task 18: Dispatcher with Retry

**File**: `internal/notifier/dispatcher.go`

```go
type Dispatcher struct {
    registry      *NotifierRegistry
    retryAttempts int
    retryDelay    time.Duration
    logger        *zap.Logger
}

func NewDispatcher(
    registry *NotifierRegistry,
    retryAttempts int,
    retryDelay time.Duration,
    logger *zap.Logger,
) *Dispatcher

func (d *Dispatcher) Send(ctx context.Context, alert *model.Alert, sub *model.AlertSubscription) error {
    notifier, ok := d.registry.Get(sub.ChannelType)
    if !ok {
        return fmt.Errorf("unknown channel type: %s", sub.ChannelType)
    }
    
    var lastErr error
    for attempt := 1; attempt <= d.retryAttempts; attempt++ {
        err := notifier.Send(ctx, alert, sub.ChannelConfig)
        if err == nil {
            return nil
        }
        
        lastErr = err
        d.logger.Warn("Notification failed, retrying",
            zap.Int("attempt", attempt),
            zap.String("channel", sub.ChannelType),
            zap.Error(err))
        
        if attempt < d.retryAttempts {
            time.Sleep(d.retryDelay)
        }
    }
    
    return fmt.Errorf("all retry attempts failed: %w", lastErr)
}

func (d *Dispatcher) SendAll(ctx context.Context, alert *model.Alert, subs []*model.AlertSubscription) []error {
    var errors []error
    for _, sub := range subs {
        if !sub.Enabled {
            continue
        }
        if err := d.Send(ctx, alert, sub); err != nil {
            errors = append(errors, err)
        }
    }
    return errors
}
```

---

### Tasks 19-24: REST API Handlers

#### AlertRuleHandler Methods

```go
// List returns all alert rules
func (h *AlertRuleHandler) List(c *gin.Context) {
    enabledParam := c.Query("enabled")
    var enabled *bool
    if enabledParam != "" {
        b := enabledParam == "true"
        enabled = &b
    }
    
    rules, err := h.service.ListRules(c.Request.Context(), enabled)
    // ...
}

// Create creates a new alert rule
func (h *AlertRuleHandler) Create(c *gin.Context) {
    var req CreateAlertRuleRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        // ...
    }
    // Validate rule type, conditions, severity
    // Create rule
}

// Update updates an existing rule
func (h *AlertRuleHandler) Update(c *gin.Context) {
    // Parse ID, bind request, update
}

// Enable/Disable toggle rule status
func (h *AlertRuleHandler) Enable(c *gin.Context) {
    // Parse ID, call service.SetRuleEnabled(id, true)
}
```

#### AlertHistoryHandler Methods

```go
// List returns alert history with filters
func (h *AlertHistoryHandler) List(c *gin.Context) {
    // Parse query params: severity, status, entity_type, from, to, limit, offset
    // Call service.ListAlerts with filters
}

// GetStats returns alert statistics
func (h *AlertHistoryHandler) GetStats(c *gin.Context) {
    // Parse time range
    // Call service.GetAlertStats
}

// Acknowledge marks alert as acknowledged
func (h *AlertHistoryHandler) Acknowledge(c *gin.Context) {
    // Parse ID, get user from context
    // Call service.AcknowledgeAlert
}
```

#### TestAlertHandler

```go
// TestAlert sends a test notification
func (h *AlertHandler) TestAlert(c *gin.Context) {
    var req TestAlertRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        // ...
    }
    
    // Create test alert
    testAlert := &model.Alert{
        Type:       "test",
        Severity:   model.SeverityLow,
        EntityType: "test",
        EntityID:   "test-" + time.Now().Format("20060102150405"),
        Title:      "Test Alert",
        Message:    req.Message,
    }
    
    // Send via specified channel
    // Return result
}
```

---

### Tasks 25-27: Advanced Evaluators

#### Velocity Evaluator

**File**: `internal/engine/velocity_evaluator.go`

```go
type VelocityEvaluator struct {
    redis  *redis.Client
    logger *zap.Logger
}

func (e *VelocityEvaluator) RuleType() string {
    return model.RuleTypeVelocity
}

func (e *VelocityEvaluator) Evaluate(ctx context.Context, event Event, rule *model.AlertRule) (*EvaluationResult, error) {
    // 1. Extract address from event
    // 2. Parse conditions (count, window)
    // 3. Increment counter in Redis with expiry
    // 4. Check if count exceeds threshold
    // 5. Create Alert if matched
}

func (e *VelocityEvaluator) incrementCounter(ctx context.Context, address, window string) (int64, error) {
    key := fmt.Sprintf("alert:velocity:%s", address)
    
    pipe := e.redis.Pipeline()
    incr := pipe.Incr(ctx, key)
    pipe.Expire(ctx, key, e.parseWindow(window))
    _, err := pipe.Exec(ctx)
    
    return incr.Val(), err
}
```

#### External Service Clients

**File**: `internal/client/risk_client.go`

```go
type RiskServiceClient struct {
    baseURL string
    client  *http.Client
    logger  *zap.Logger
}

func (c *RiskServiceClient) GetRiskScore(ctx context.Context, address string) (*RiskScoreResponse, error) {
    url := fmt.Sprintf("%s/api/v1/risk/%s", c.baseURL, address)
    // HTTP GET request
}
```

**File**: `internal/client/graph_client.go`

```go
type GraphServiceClient struct {
    baseURL string
    client  *http.Client
    logger  *zap.Logger
}

func (c *GraphServiceClient) GetAddressTags(ctx context.Context, address string) ([]string, error) {
    url := fmt.Sprintf("%s/api/v1/addresses/%s/tags", c.baseURL, address)
    // HTTP GET request
}

func (c *GraphServiceClient) GetClusterRisk(ctx context.Context, address string) (*ClusterRiskResponse, error) {
    url := fmt.Sprintf("%s/api/v1/clusters/by-address/%s", c.baseURL, address)
    // HTTP GET request
}
```

---

## File Structure

```
services/alert-service/
├── cmd/
│   └── main.go                    # Application entry point
├── configs/
│   └── config.yaml                # Configuration file
├── internal/
│   ├── client/                    # External service clients
│   │   ├── graph_client.go
│   │   └── risk_client.go
│   ├── config/
│   │   └── config.go              # ✅ Done
│   ├── dedup/
│   │   └── deduplicator.go        # Redis deduplication
│   ├── engine/
│   │   ├── alert_engine.go        # Main orchestrator
│   │   ├── evaluator.go           # Interface & registry
│   │   ├── risk_score_evaluator.go
│   │   ├── transaction_value_evaluator.go
│   │   ├── tag_match_evaluator.go
│   │   ├── velocity_evaluator.go
│   │   └── cluster_risk_evaluator.go
│   ├── handler/
│   │   ├── route.go               # Route definitions
│   │   ├── alert_rule_handler.go
│   │   ├── alert_history_handler.go
│   │   └── subscription_handler.go
│   ├── kafka/
│   │   └── consumer.go            # Kafka consumer
│   ├── model/
│   │   ├── alert.go               # ✅ Done
│   │   └── event.go               # Kafka event models
│   ├── notifier/
│   │   ├── notifier.go            # Interface & registry
│   │   ├── dispatcher.go          # Dispatch with retry
│   │   ├── webhook.go
│   │   ├── email.go
│   │   └── slack.go
│   ├── repository/
│   │   ├── alert_rule_repository.go       # ✅ Done
│   │   ├── alert_history_repository.go    # ✅ Done
│   │   └── alert_subscription_repository.go
│   └── service/
│       └── alert_service.go       # Business logic
├── test/
│   ├── unit/
│   │   ├── evaluator_test.go
│   │   └── notifier_test.go
│   └── integration/
│       └── alert_flow_test.go
├── Makefile
├── Dockerfile
├── go.mod                         # ✅ Done
├── go.sum                         # ✅ Done
└── README.md                      # ✅ Done
```

---

## API Specification

### Alert Rules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/alert-rules` | List all rules |
| GET | `/api/v1/alert-rules/:id` | Get rule by ID |
| POST | `/api/v1/alert-rules` | Create new rule |
| PUT | `/api/v1/alert-rules/:id` | Update rule |
| DELETE | `/api/v1/alert-rules/:id` | Delete rule |
| POST | `/api/v1/alert-rules/:id/enable` | Enable rule |
| POST | `/api/v1/alert-rules/:id/disable` | Disable rule |

### Alert History

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/alerts` | List alert history |
| GET | `/api/v1/alerts/:id` | Get alert details |
| GET | `/api/v1/alerts/stats` | Get alert statistics |
| POST | `/api/v1/alerts/:id/acknowledge` | Acknowledge alert |

### Subscriptions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/subscriptions` | List subscriptions |
| POST | `/api/v1/subscriptions` | Create subscription |
| DELETE | `/api/v1/subscriptions/:id` | Delete subscription |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/alerts/test` | Test notification |

---

## Testing Strategy

### Unit Tests

```go
// evaluator_test.go
func TestRiskScoreEvaluator_Evaluate(t *testing.T) {
    evaluator := NewRiskScoreEvaluator()
    
    tests := []struct {
        name     string
        event    Event
        rule     *model.AlertRule
        expected bool
    }{
        {
            name: "score above threshold triggers alert",
            event: Event{
                Type: "risk_score",
                Data: map[string]interface{}{"score": 85.0, "address": "0x123"},
            },
            rule: &model.AlertRule{
                RuleType:   model.RuleTypeRiskScore,
                Conditions: model.JSONB{"threshold": 80.0, "operator": ">="},
                Severity:   model.SeverityHigh,
            },
            expected: true,
        },
        // More cases...
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := evaluator.Evaluate(context.Background(), tt.event, tt.rule)
            assert.NoError(t, err)
            assert.Equal(t, tt.expected, result.Matched)
        })
    }
}
```

### Integration Tests

```go
// alert_flow_test.go
func TestAlertFlow_EndToEnd(t *testing.T) {
    // 1. Setup test database
    // 2. Create alert rule
    // 3. Create subscription with webhook
    // 4. Start mock webhook server
    // 5. Publish event to Kafka
    // 6. Verify webhook received notification
    // 7. Verify alert history created
}
```

---

## Deployment

### Dockerfile

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o alert-service ./cmd/main.go

FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/alert-service .
COPY --from=builder /app/configs ./configs
EXPOSE 8083
CMD ["./alert-service"]
```

### Makefile

```makefile
.PHONY: build run test lint docker

build:
	go build -o bin/alert-service ./cmd/main.go

run:
	go run ./cmd/main.go

test:
	go test -v -cover ./...

lint:
	golangci-lint run

docker:
	docker build -t chain-risk/alert-service:latest .
```

---

## Execution Order

Execute tasks in this order to minimize blocking dependencies:

```
Week 1: Tasks 1-5 (Infrastructure)
        ↓
Week 2: Tasks 6-10 (Engine) + Tasks 14-18 (Notifiers) [parallel]
        ↓
Week 3: Tasks 11-13 (Dedup/Flow) + Tasks 19-24 (API)
        ↓
Week 4: Tasks 25-27 (Advanced) + Tasks 28-32 (Testing)
```

---

## Related Documentation

- [Project Overview](../architecture/PROJECT_OVERVIEW.md)
- [Alert Service Plan](./ALERT_SERVICE_PLAN.md)
- [Development Plan](./DEVELOPMENT_PLAN.md)
- [Query Service](../../services/query-service/README.md) (reference implementation)
