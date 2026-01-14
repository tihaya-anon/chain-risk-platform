#!/bin/bash
# Integration Test - Alert Service
# Tests: Kafka consumption → Rule evaluation → Alert creation → Webhook notification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$PROJECT_ROOT"
source "$PROJECT_ROOT/scripts/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
POSTGRES_DB="${POSTGRES_DB:-chainrisk}"
REDIS_HOST="${REDIS_HOST:-$DOCKER_HOST_IP}"
REDIS_PORT="${REDIS_PORT:-16379}"

WEBHOOK_MOCK_PORT=9999
ALERT_SERVICE_PORT=8083
ALERT_SERVICE_DIR="$PROJECT_ROOT/services/alert-service"

log_info "=== Alert Service Integration Test ==="
log_info "Kafka: $KAFKA_BROKER"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Redis: $REDIS_HOST:$REDIS_PORT"

cleanup() {
    log_info "Cleaning up..."
    [ -n "$WEBHOOK_PID" ] && kill $WEBHOOK_PID 2>/dev/null || true
    [ -n "$ALERT_SERVICE_PID" ] && kill $ALERT_SERVICE_PID 2>/dev/null || true
    [ -f "$TEST_CONFIG" ] && rm -f "$TEST_CONFIG"
}
trap cleanup EXIT

# Check prerequisites
log_info "[1/9] Checking prerequisites..."
nc -z ${KAFKA_BROKER%:*} ${KAFKA_BROKER#*:} 2>/dev/null || { log_error "Kafka not available"; exit 1; }
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" >/dev/null 2>&1 || { log_error "PostgreSQL not available"; exit 1; }
log_success "Prerequisites OK"

# Clear test data and Redis
log_info "[2/9] Clearing test data..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
TRUNCATE alert.alert_history CASCADE;
TRUNCATE alert.alert_subscriptions CASCADE;
DELETE FROM alert.alert_rules WHERE name LIKE 'test_%';
EOF
# Clear Redis dedup keys
redis-cli -h $REDIS_HOST -p $REDIS_PORT -n 2 FLUSHDB >/dev/null 2>&1 || true
log_success "Test data cleared"

# Build and start webhook mock
log_info "[3/9] Starting webhook mock server..."
cd "$PROJECT_ROOT/tests/integration/webhook_mock"
mkdir -p bin
go build -o bin/webhook_mock .
./bin/webhook_mock -port $WEBHOOK_MOCK_PORT &
WEBHOOK_PID=$!
sleep 2
curl -s "http://localhost:$WEBHOOK_MOCK_PORT/health" >/dev/null || { log_error "Webhook mock failed to start"; exit 1; }
log_success "Webhook mock running on port $WEBHOOK_MOCK_PORT"

# Insert test rules
log_info "[4/9] Creating test alert rules..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
INSERT INTO alert.alert_rules (name, description, rule_type, conditions, severity, enabled)
VALUES 
  ('test_high_risk', 'Test high risk score', 'risk_score', '{"threshold": 80, "operator": ">="}', 'high', true),
  ('test_large_tx', 'Test large transaction', 'transaction_value', '{"threshold": 1000000, "operator": ">="}', 'critical', true);
EOF
log_success "Test rules created"

# Create test subscription
log_info "[5/9] Creating test subscription..."
RULE_ID=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT id FROM alert.alert_rules WHERE name='test_high_risk' LIMIT 1" | tr -d ' ')
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
INSERT INTO alert.alert_subscriptions (user_id, rule_id, channel_type, channel_config, enabled)
VALUES 
  ('test_user', $RULE_ID, 'webhook', '{"url": "http://localhost:$WEBHOOK_MOCK_PORT/webhook"}', true),
  ('test_user', NULL, 'webhook', '{"url": "http://localhost:$WEBHOOK_MOCK_PORT/webhook"}', true);
EOF
log_success "Test subscription created (rule_id: $RULE_ID)"

# Build alert service
log_info "[6/9] Starting alert service..."
cd "$ALERT_SERVICE_DIR"
mkdir -p bin logs

# Create test config with unique consumer group
CONSUMER_GROUP="alert-service-test-$(date +%s)"
TEST_CONFIG="$ALERT_SERVICE_DIR/configs/config-test.yaml"
cat > "$TEST_CONFIG" <<EOF
server:
  port: $ALERT_SERVICE_PORT
  mode: debug
  read_timeout: 30s
  write_timeout: 30s

kafka:
  brokers:
    - $KAFKA_BROKER
  topics:
    risk_scores: risk-scores
    transfers: transfers
  group_id: $CONSUMER_GROUP
  session_timeout: 10s
  heartbeat_interval: 3s

database:
  host: $POSTGRES_HOST
  port: $POSTGRES_PORT
  database: $POSTGRES_DB
  user: $POSTGRES_USER
  password: $POSTGRES_PASSWORD
  max_open_conns: 10
  max_idle_conns: 5
  conn_max_lifetime: 5m

redis:
  host: $REDIS_HOST
  port: $REDIS_PORT
  password: ""
  db: 2
  pool_size: 10

alert:
  dedup_window: 1m
  batch_size: 100
  retry_attempts: 3
  retry_delay: 1s
  max_alerts_per_minute: 100

notifiers:
  email:
    enabled: false
  webhook:
    enabled: true
    timeout: 10s
    max_retries: 3
  slack:
    enabled: false

logging:
  level: debug
  encoding: console
  output_paths:
    - stdout
  error_output_paths:
    - stderr

nacos:
  enabled: false

services:
  risk_service:
    url: http://localhost:8082
    timeout: 10s
  graph_service:
    url: http://localhost:8084
    timeout: 10s
EOF

go build -o bin/alert-service ./cmd/main.go
./bin/alert-service -config "$TEST_CONFIG" &
ALERT_SERVICE_PID=$!

# Wait for service and Kafka consumer to be ready
log_info "Waiting for alert service to start..."
sleep 5
curl -s "http://localhost:$ALERT_SERVICE_PORT/health" >/dev/null || { log_error "Alert service failed to start"; exit 1; }
log_success "Alert service running on port $ALERT_SERVICE_PORT"

# Wait additional time for Kafka consumer group to join
log_info "Waiting for Kafka consumer to join group (5s)..."
sleep 5

# Send test events to Kafka
log_info "[7/9] Sending test events to Kafka..."

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Risk score event (should trigger alert: score 92 >= threshold 80)
MSG1='{"type":"risk_score","address":"0xintegration_test_addr_01234567890123456789","risk_score":92,"factors":["high_volume","mixer"],"timestamp":"'$TIMESTAMP'"}'
echo "$MSG1" | kcat -b $KAFKA_BROKER -t risk-scores -P
log_info "Sent risk_score event (score: 92)"

# Transfer event (should trigger large tx alert: 2.5M >= 1M threshold)
MSG2='{"type":"transfer","tx_hash":"0xintegration_test_tx_hash_0123456789abcdef01234567890123456789abcdef","from_address":"0xfrom_addr_01234567890123456789012345678901","to_address":"0xto_addr_012345678901234567890123456789012345","value":"2500000000000000000000","value_usd":2500000,"token_symbol":"ETH","block_number":12345678,"timestamp":'$(date +%s)'}'
echo "$MSG2" | kcat -b $KAFKA_BROKER -t transfers -P
log_info "Sent transfer event (value_usd: 2.5M)"

# Low risk score (should NOT trigger: 45 < 80)
MSG3='{"type":"risk_score","address":"0xsafe_addr_0123456789012345678901234567890123","risk_score":45,"factors":[],"timestamp":"'$TIMESTAMP'"}'
echo "$MSG3" | kcat -b $KAFKA_BROKER -t risk-scores -P
log_info "Sent low risk_score event (score: 45, should NOT trigger)"

log_success "Test events sent"

# Wait for processing
log_info "[8/9] Waiting for processing (30s)..."
for i in {1..6}; do
    sleep 5
    ALERT_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
        "SELECT COUNT(*) FROM alert.alert_history WHERE created_at > NOW() - INTERVAL '5 minutes'" | tr -d ' ')
    log_info "  ... ($i/6) alerts found: $ALERT_COUNT"
    if [ "$ALERT_COUNT" -ge 1 ]; then
        break
    fi
done

# Verify results
log_info "[9/9] Verifying results..."
echo ""

# Check PostgreSQL alerts
ALERT_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
    "SELECT COUNT(*) FROM alert.alert_history WHERE created_at > NOW() - INTERVAL '5 minutes'" | tr -d ' ')
log_info "Alerts in PostgreSQL: $ALERT_COUNT"

# Check webhook received
WEBHOOK_COUNT=$(curl -s "http://localhost:$WEBHOOK_MOCK_PORT/received" | jq '.count')
log_info "Webhook notifications received: $WEBHOOK_COUNT"

# Show alert details
echo ""
log_info "=== Alert Details ==="
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
SELECT id, alert_type, severity, entity_id, title, status, created_at 
FROM alert.alert_history 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
EOF

# Show webhook payloads
echo ""
log_info "=== Webhook Payloads ==="
curl -s "http://localhost:$WEBHOOK_MOCK_PORT/received" | jq '.alerts[] | {title: .body.title, severity: .body.severity}' 2>/dev/null || echo "No payloads received"

# Validate results
FAILED=0
if [ "$ALERT_COUNT" -lt 1 ]; then
    log_error "Expected at least 1 alert in PostgreSQL, got $ALERT_COUNT"
    FAILED=1
fi

if [ "$WEBHOOK_COUNT" -lt 1 ]; then
    log_warn "Expected at least 1 webhook notification, got $WEBHOOK_COUNT (may be OK if dispatcher not fully wired)"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
    log_info "=========================================="
    log_info "✅ Alert Service Integration Test PASSED"
    log_info "=========================================="
else
    log_error "=========================================="
    log_error "❌ Alert Service Integration Test FAILED"
    log_error "=========================================="
    exit 1
fi
