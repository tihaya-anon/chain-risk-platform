#!/bin/bash
# Integration Test - Phase 2: Flink Processing (Kafka → PostgreSQL)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
source "$SCRIPT_DIR/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"
CONSUMER_GROUP="stream-processor-test-$(date +%s)"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"

START_BLOCK="${START_BLOCK:-1000}"
NUM_BLOCKS="${NUM_BLOCKS:-30}"
EXPECTED_TRANSFERS=$((NUM_BLOCKS * 3))
EXPECTED_TRANSACTIONS=$NUM_BLOCKS

log_info "=== Phase 2: Flink Processing ==="
log_info "Kafka: $KAFKA_BROKER, PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Consumer Group: $CONSUMER_GROUP (dynamic)"

cleanup() {
    command -v tmux &>/dev/null && tmux kill-session -t flink-stream 2>/dev/null || true
    [ -n "$FLINK_PID" ] && kill $FLINK_PID 2>/dev/null || true
}
trap cleanup EXIT

# Check prerequisites
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" >/dev/null 2>&1 \
    || { log_error "Cannot connect to PostgreSQL"; exit 1; }
nc -z $DOCKER_HOST_IP 19092 2>/dev/null || { log_error "Cannot connect to Kafka"; exit 1; }

# Check Kafka has data
if command -v kcat &>/dev/null; then
    COUNT=$(kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o beginning 2>/dev/null | wc -l | tr -d ' ')
    [ "$COUNT" -eq 0 ] && { log_error "No Kafka data. Run Phase 1 first."; exit 1; }
    log_info "Kafka messages: $COUNT"
fi

# Clear PostgreSQL
log_info "Clearing test data..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF

# Run Flink
export KAFKA_BROKERS="$KAFKA_BROKER"
export KAFKA_TOPIC="$KAFKA_TOPIC"
export KAFKA_GROUP_ID="$CONSUMER_GROUP"
export POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD
export ENABLE_KAFKA_PRODUCER="false"
export ENABLE_STATE_TRACKING="true"

if command -v tmux &>/dev/null; then
    tmux kill-session -t flink-stream 2>/dev/null || true
    ./scripts/run-flink.sh &
    FLINK_PID=$!
    sleep 5
else
    ./scripts/run-flink.sh &
    FLINK_PID=$!
fi

log_info "Waiting 60s for processing..."
sleep 60

for i in {1..5}; do
    TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers" 2>/dev/null | tr -d ' ')
    [ "$TRANSFER_COUNT" -gt 0 ] && break
    log_warn "No data yet ($i/5), waiting 10s..."
    sleep 10
done

# Verify
TX_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions" | tr -d ' ')

log_info "Results: Transfers=$TRANSFER_COUNT (expected >=$EXPECTED_TRANSFERS), Transactions=$TX_COUNT (expected >=$EXPECTED_TRANSACTIONS)"

FAILED=0
[ "$TRANSFER_COUNT" -lt "$EXPECTED_TRANSFERS" ] && { log_error "Transfer count too low"; FAILED=1; }
[ "$TX_COUNT" -lt "$EXPECTED_TRANSACTIONS" ] && { log_error "Transaction count too low"; FAILED=1; }

[ "$FAILED" -eq 0 ] && log_info "✓ Verification passed"

echo ""
echo "=== Sample Transfers ==="
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
SELECT tx_hash, block_number, from_address, to_address, transfer_type, token_symbol
FROM chain_data.transfers ORDER BY block_number DESC LIMIT 5;
EOF

log_info "✅ Phase 2 Complete"
log_info "Next: ./scripts/test-integration-phase3.sh"

exit $FAILED
