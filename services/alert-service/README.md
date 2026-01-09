# Alert Service

Real-time alerting and notification system for Chain Risk Platform.

## Features

- **Alert Rule Engine**: Flexible rule-based alert triggering
- **Multi-Channel Notifications**: Email, Webhook, Slack, Telegram
- **Kafka Event Streaming**: Real-time event consumption
- **Deduplication**: Redis-based alert deduplication
- **Alert History**: Complete audit trail
- **REST API**: Full CRUD for rules and subscriptions

## Architecture

```
Kafka Events → Alert Engine → Rule Evaluator → Notification Dispatcher
                    ↓                               ↓
              PostgreSQL                    Email/Webhook/Slack
                    ↓
              Redis (Dedup)
```

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Redis 7+
- Kafka 3.x

### Installation

```bash
# Install dependencies
go mod download

# Run database migrations
psql -h localhost -p 15432 -U chainrisk -d chainrisk -f ../../infra/init-scripts/postgres/03-alert-tables.sql

# Copy config
cp configs/config.yaml configs/config.local.yaml
# Edit configs/config.local.yaml with your settings

# Run service
go run cmd/main.go
```

### Development

```bash
# Run with hot reload
air

# Run tests
go test ./...

# Build
go build -o bin/alert-service cmd/main.go

# Run
./bin/alert-service
```

## Configuration

See `configs/config.yaml` for all available options.

Key configurations:
- **Server**: Port, timeouts
- **Kafka**: Brokers, topics, consumer group
- **Database**: PostgreSQL connection
- **Redis**: Deduplication cache
- **Alert**: Dedup window, batch size, retry settings
- **Notifiers**: Email, Webhook, Slack settings

## API Endpoints

### Alert Rules

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
POST   /api/v1/alerts/:id/acknowledge   Acknowledge alert
```

### Subscriptions

```
POST   /api/v1/subscriptions            Create subscription
GET    /api/v1/subscriptions            List subscriptions
DELETE /api/v1/subscriptions/:id       Delete subscription
```

### Health Check

```
GET    /health                          Health check
```

## Rule Types

| Type | Description | Example |
|------|-------------|---------|
| `risk_score` | Risk score threshold | Score >= 80 |
| `transaction_value` | Large transaction | Value > $1M |
| `tag_match` | Address tag matching | Tags: ["Mixer", "Sanctioned"] |
| `graph_pattern` | Graph pattern detection | Cluster risk |
| `velocity` | Transaction frequency | >100 tx/hour |
| `cluster_risk` | Cluster-level risk | Cluster score >= 70 |

## Notification Channels

### Email

```json
{
  "channel_type": "email",
  "channel_config": {
    "email": "admin@example.com"
  }
}
```

### Webhook

```json
{
  "channel_type": "webhook",
  "channel_config": {
    "url": "https://api.example.com/alerts",
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

### Slack

```json
{
  "channel_type": "slack",
  "channel_config": {
    "webhook_url": "https://hooks.slack.com/services/xxx"
  }
}
```

## Database Schema

### alert_rules

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| name | VARCHAR(255) | Rule name |
| rule_type | VARCHAR(50) | Rule type |
| conditions | JSONB | Rule conditions |
| severity | VARCHAR(20) | Severity level |
| enabled | BOOLEAN | Enable status |

### alert_history

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| rule_id | BIGINT | Rule reference |
| alert_type | VARCHAR(50) | Alert type |
| severity | VARCHAR(20) | Severity |
| entity_type | VARCHAR(50) | Entity type |
| entity_id | VARCHAR(255) | Entity ID |
| status | VARCHAR(20) | Status |

### alert_subscriptions

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| user_id | VARCHAR(255) | User ID |
| rule_id | BIGINT | Rule reference |
| channel_type | VARCHAR(50) | Channel type |
| channel_config | JSONB | Channel config |

## Development Status

- [x] Database schema
- [x] Configuration loading
- [x] Database repositories
- [x] Basic HTTP server
- [x] Health check endpoint
- [ ] Kafka consumer
- [ ] Rule evaluator
- [ ] Notification dispatcher
- [ ] Deduplication logic
- [ ] Complete REST API
- [ ] Unit tests
- [ ] Integration tests

## TODO

See [Alert Service Development Plan](../../docs/development/ALERT_SERVICE_PLAN.md)

## License

MIT
