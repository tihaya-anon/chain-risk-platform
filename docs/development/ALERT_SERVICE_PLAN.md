# Alert Service Development Plan

## Overview

Alert Service is a real-time notification system that monitors high-risk transactions and addresses, triggering alerts through multiple channels (email, webhook, Slack, etc.).

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Sources                                │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Kafka        │    │ Risk Service │    │ Graph Service│          │
│  │ (real-time)  │    │ (API poll)   │    │ (API poll)   │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                  │
└─────────┼───────────────────┼───────────────────┼──────────────────┘
          │                   │                   │
          └───────────────────┴───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Alert Service (Go)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Alert Engine                              │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │ Rule       │  │ Aggregation│  │ Dedup      │             │   │
│  │  │ Evaluator  │─▶│ Window     │─▶│ Filter     │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Notification Dispatcher                     │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │   │
│  │  │ Email    │  │ Webhook  │  │ Slack    │  │ Telegram │     │   │
│  │  │ Notifier │  │ Notifier │  │ Notifier │  │ Notifier │     │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (Alert Storage)                      │   │
│  │  - alert_rules                                               │   │
│  │  - alert_history                                             │   │
│  │  - alert_subscriptions                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Reason |
|-----------|------------|--------|
| Language | Go 1.21+ | High performance, existing microservice stack |
| Framework | Gin | Consistent with query-service |
| Message Queue | Kafka | Real-time event streaming |
| Database | PostgreSQL | Rule and history persistence |
| Cache | Redis | Deduplication, rate limiting |
| Email | SMTP / SendGrid | Email notifications |
| Webhook | HTTP Client | Generic webhook support |

## Database Schema

### alert_rules

```sql
CREATE TABLE alert_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'risk_score', 'transaction_value', 'tag_match', 'graph_pattern'
    conditions JSONB NOT NULL,      -- Rule conditions (flexible)
    severity VARCHAR(20) NOT NULL,  -- 'low', 'medium', 'high', 'critical'
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
```

**Example conditions**:
```json
{
  "rule_type": "risk_score",
  "threshold": 80,
  "operator": ">=",
  "window": "5m"
}
```

```json
{
  "rule_type": "transaction_value",
  "threshold": 1000000,
  "operator": ">",
  "currency": "USD"
}
```

```json
{
  "rule_type": "tag_match",
  "tags": ["Mixer", "Sanctioned"],
  "match_type": "any"
}
```

### alert_history

```sql
CREATE TABLE alert_history (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES alert_rules(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'address', 'transaction'
    entity_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,                   -- Additional context
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    notified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX idx_alert_history_entity ON alert_history(entity_type, entity_id);
CREATE INDEX idx_alert_history_created ON alert_history(created_at DESC);
CREATE INDEX idx_alert_history_status ON alert_history(status);
```

### alert_subscriptions

```sql
CREATE TABLE alert_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    rule_id BIGINT REFERENCES alert_rules(id),
    channel_type VARCHAR(50) NOT NULL, -- 'email', 'webhook', 'slack', 'telegram'
    channel_config JSONB NOT NULL,     -- Channel-specific config
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_subs_user ON alert_subscriptions(user_id);
CREATE INDEX idx_alert_subs_rule ON alert_subscriptions(rule_id);
```

**Example channel_config**:
```json
{
  "channel_type": "email",
  "email": "admin@example.com"
}
```

```json
{
  "channel_type": "webhook",
  "url": "https://api.example.com/alerts",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

```json
{
  "channel_type": "slack",
  "webhook_url": "https://hooks.slack.com/services/xxx"
}
```

## Core Components

### 1. Alert Engine

**Responsibilities**:
- Consume events from Kafka (`risk-scores`, `transfers`)
- Evaluate alert rules against incoming data
- Aggregate alerts within time windows
- Deduplicate repeated alerts

**Implementation**:
```go
type AlertEngine struct {
    ruleRepo       repository.AlertRuleRepository
    historyRepo    repository.AlertHistoryRepository
    riskClient     *client.RiskServiceClient
    graphClient    *client.GraphServiceClient
    dispatcher     *notifier.Dispatcher
    deduplicator   *cache.Deduplicator
    kafkaConsumer  *kafka.Consumer
}

func (e *AlertEngine) Start(ctx context.Context) error {
    // Subscribe to Kafka topics
    topics := []string{"risk-scores", "transfers"}
    
    for {
        msg := e.kafkaConsumer.Poll(ctx)
        
        // Evaluate rules
        alerts := e.evaluateRules(msg)
        
        // Deduplicate
        alerts = e.deduplicator.Filter(alerts)
        
        // Dispatch notifications
        for _, alert := range alerts {
            e.dispatcher.Send(alert)
            e.historyRepo.Create(alert)
        }
    }
}
```

### 2. Rule Evaluator

**Rule Types**:

| Rule Type | Description | Data Source |
|-----------|-------------|-------------|
| `risk_score` | Risk score threshold | Risk Service API / Kafka |
| `transaction_value` | Large transaction detection | Kafka `transfers` |
| `tag_match` | Address tag matching | Graph Service API |
| `graph_pattern` | Graph pattern detection | Graph Service API |
| `velocity` | Transaction frequency | Kafka + Redis counter |
| `cluster_risk` | Cluster-level risk | Graph Service API |

**Example Implementation**:
```go
type RuleEvaluator interface {
    Evaluate(ctx context.Context, event Event) ([]Alert, error)
}

type RiskScoreEvaluator struct {
    threshold float64
    operator  string
}

func (r *RiskScoreEvaluator) Evaluate(ctx context.Context, event Event) ([]Alert, error) {
    score := event.Data["risk_score"].(float64)
    
    if r.compare(score, r.threshold, r.operator) {
        return []Alert{{
            Type:     "high_risk_address",
            Severity: r.determineSeverity(score),
            EntityID: event.Data["address"].(string),
            Title:    fmt.Sprintf("High risk score detected: %.2f", score),
            Message:  r.buildMessage(event),
        }}, nil
    }
    
    return nil, nil
}
```

### 3. Notification Dispatcher

**Multi-Channel Support**:

```go
type Dispatcher struct {
    notifiers map[string]Notifier
}

type Notifier interface {
    Send(ctx context.Context, alert Alert, config ChannelConfig) error
}

// Email Notifier
type EmailNotifier struct {
    smtpClient *smtp.Client
}

func (n *EmailNotifier) Send(ctx context.Context, alert Alert, config ChannelConfig) error {
    email := config["email"].(string)
    
    msg := n.buildEmailMessage(alert)
    return n.smtpClient.SendMail(email, msg)
}

// Webhook Notifier
type WebhookNotifier struct {
    httpClient *http.Client
}

func (n *WebhookNotifier) Send(ctx context.Context, alert Alert, config ChannelConfig) error {
    url := config["url"].(string)
    headers := config["headers"].(map[string]string)
    
    payload := n.buildPayload(alert)
    return n.httpClient.Post(url, payload, headers)
}

// Slack Notifier
type SlackNotifier struct {
    httpClient *http.Client
}

func (n *SlackNotifier) Send(ctx context.Context, alert Alert, config ChannelConfig) error {
    webhookURL := config["webhook_url"].(string)
    
    slackMsg := n.buildSlackMessage(alert)
    return n.httpClient.Post(webhookURL, slackMsg, nil)
}
```

### 4. Deduplication

**Strategy**: Redis-based time window deduplication

```go
type Deduplicator struct {
    redis  *redis.Client
    window time.Duration // e.g., 5 minutes
}

func (d *Deduplicator) Filter(alerts []Alert) []Alert {
    var filtered []Alert
    
    for _, alert := range alerts {
        key := d.buildKey(alert)
        
        // Check if alert was sent recently
        exists, _ := d.redis.Exists(key).Result()
        if exists == 0 {
            filtered = append(filtered, alert)
            
            // Set expiry
            d.redis.Set(key, "1", d.window)
        }
    }
    
    return filtered
}

func (d *Deduplicator) buildKey(alert Alert) string {
    return fmt.Sprintf("alert:dedup:%s:%s:%s", 
        alert.Type, alert.EntityType, alert.EntityID)
}
```

## API Endpoints

### Alert Rules Management

```
POST   /api/v1/alert-rules              Create alert rule
GET    /api/v1/alert-rules              List alert rules
GET    /api/v1/alert-rules/:id          Get alert rule
PUT    /api/v1/alert-rules/:id          Update alert rule
DELETE /api/v1/alert-rules/:id          Delete alert rule
POST   /api/v1/alert-rules/:id/enable   Enable rule
POST   /api/v1/alert-rules/:id/disable  Disable rule
```

### Alert History

```
GET    /api/v1/alerts                   List alert history
GET    /api/v1/alerts/:id               Get alert details
GET    /api/v1/alerts/stats             Alert statistics
```

### Subscriptions

```
POST   /api/v1/subscriptions            Create subscription
GET    /api/v1/subscriptions            List subscriptions
DELETE /api/v1/subscriptions/:id       Delete subscription
```

### Test Endpoint

```
POST   /api/v1/alerts/test              Test alert notification
```

## Configuration

### config.yaml

```yaml
server:
  port: 8083
  mode: release

kafka:
  brokers:
    - localhost:19092
  topics:
    - risk-scores
    - transfers
  group_id: alert-service

database:
  host: localhost
  port: 15432
  database: chainrisk
  user: chainrisk
  password: chainrisk123

redis:
  host: localhost
  port: 16379
  db: 2

alert:
  dedup_window: 5m
  batch_size: 100
  retry_attempts: 3

notifiers:
  email:
    enabled: true
    smtp_host: smtp.gmail.com
    smtp_port: 587
    from: alerts@chainrisk.com
    
  webhook:
    enabled: true
    timeout: 10s
    
  slack:
    enabled: true
    timeout: 5s

nacos:
  server_addr: localhost:18848
  namespace: public
  group: DEFAULT_GROUP
  data_id: alert-service
```

## Development Phases

### Phase 1: Core Infrastructure (Week 1)

- [x] Project structure setup
- [ ] Database schema creation
- [ ] Basic Gin server setup
- [ ] Kafka consumer integration
- [ ] PostgreSQL repository layer
- [ ] Redis client setup

**Deliverables**:
- Alert Service skeleton
- Database migrations
- Kafka consumer working

### Phase 2: Alert Engine (Week 2)

- [ ] Rule evaluator framework
- [ ] Implement rule types:
  - [ ] Risk score threshold
  - [ ] Transaction value threshold
  - [ ] Tag matching
- [ ] Deduplication logic
- [ ] Alert history persistence

**Deliverables**:
- Working alert engine
- Basic rule evaluation
- Deduplication working

### Phase 3: Notification Channels (Week 3)

- [ ] Notification dispatcher
- [ ] Email notifier (SMTP)
- [ ] Webhook notifier
- [ ] Slack notifier
- [ ] Retry mechanism
- [ ] Error handling

**Deliverables**:
- Multi-channel notifications
- Reliable delivery

### Phase 4: API & Management (Week 4)

- [ ] Alert rules CRUD API
- [ ] Alert history API
- [ ] Subscription management API
- [ ] Test endpoint
- [ ] API documentation (OpenAPI)

**Deliverables**:
- Complete REST API
- API documentation

### Phase 5: Advanced Features (Week 5)

- [ ] Graph pattern rules
- [ ] Velocity rules (rate limiting)
- [ ] Cluster risk rules
- [ ] Alert aggregation
- [ ] Dashboard integration

**Deliverables**:
- Advanced rule types
- BFF integration

### Phase 6: Testing & Deployment (Week 6)

- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] Load testing
- [ ] Nacos integration
- [ ] Docker image
- [ ] K8s deployment

**Deliverables**:
- Production-ready service
- Deployment configs

## Built-in Alert Rules (Default)

### High Risk Address

```yaml
name: High Risk Address Detected
type: risk_score
conditions:
  threshold: 80
  operator: ">="
severity: high
```

### Large Transaction

```yaml
name: Large Transaction Alert
type: transaction_value
conditions:
  threshold: 1000000
  operator: ">"
  currency: USD
severity: medium
```

### Sanctioned Address Interaction

```yaml
name: Sanctioned Address Interaction
type: tag_match
conditions:
  tags: ["Sanctioned", "OFAC"]
  match_type: any
severity: critical
```

### Mixer Usage

```yaml
name: Mixer Usage Detected
type: tag_match
conditions:
  tags: ["Mixer", "Tornado Cash"]
  match_type: any
severity: high
```

### High Velocity Transactions

```yaml
name: High Transaction Velocity
type: velocity
conditions:
  count: 100
  window: 1h
severity: medium
```

## Monitoring & Metrics

### Prometheus Metrics

```go
var (
    alertsProcessed = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "alerts_processed_total",
            Help: "Total number of alerts processed",
        },
        []string{"rule_type", "severity"},
    )
    
    alertsSent = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "alerts_sent_total",
            Help: "Total number of alerts sent",
        },
        []string{"channel", "status"},
    )
    
    alertLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "alert_processing_duration_seconds",
            Help: "Alert processing latency",
        },
        []string{"rule_type"},
    )
)
```

## Testing Strategy

### Unit Tests

- Rule evaluator logic
- Deduplication logic
- Notifier implementations
- Repository layer

### Integration Tests

- Kafka consumer
- Database operations
- Redis operations
- External API calls (mocked)

### E2E Tests

- Trigger alert from Kafka
- Verify notification sent
- Check alert history persisted

## Dependencies

### Internal Services

- Risk Service (API)
- Graph Service (API)
- Kafka (event streaming)

### External Services

- SMTP server (email)
- Slack workspace (optional)
- Webhook endpoints (user-defined)

## Future Enhancements

- [ ] Telegram notifier
- [ ] Discord notifier
- [ ] SMS notifier (Twilio)
- [ ] Alert templates
- [ ] Alert escalation
- [ ] Alert acknowledgment
- [ ] Alert comments/notes
- [ ] Alert dashboard
- [ ] ML-based alert prioritization
- [ ] Alert correlation

## References

- [Project Overview](../architecture/PROJECT_OVERVIEW.md)
- [Development Plan](./DEVELOPMENT_PLAN.md)
- [API Specs Guide](../api-specs/API_SPECS_GUIDE.md)
