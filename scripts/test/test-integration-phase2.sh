#!/bin/bash
# Integration Test - Phase 2: Flink Processing (Kafka → PostgreSQL)
# Can be run repeatedly - uses dynamic consumer group to read from beginning

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"
source "$PROJECT_ROOT/scripts/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"
# Dynamic consumer group = always reads from beginning
CONSUMER_GROUP="test-$(date +%s)"
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
log_info "Kafka: $KAFKA_BROKER → PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Consumer Group: $CONSUMER_GROUP (new group = reads from beginning)"

cleanup() {
    log_info "Stopping Flink..."
    tmux kill-session -t flink-stream 2>/dev/null || true
    [ -n "$FLINK_PID" ] && kill $FLINK_PID 2>/dev/null || true
}
trap cleanup EXIT

# Check prerequisites
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" >/dev/null 2>&1 \
    || { log_error "Cannot connect to PostgreSQL"; exit 1; }
nc -z ${KAFKA_BROKER%:*} ${KAFKA_BROKER#*:} 2>/dev/null || { log_error "Cannot connect to Kafka"; exit 1; }

# Check Kafka has data
if command -v kcat &>/dev/null; then
    COUNT=$(kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o beginning 2>/dev/null | wc -l | tr -d ' ')
    [ "$COUNT" -eq 0 ] && { log_error "No Kafka data. Run Phase 1 first: make test-integration-phase1"; exit 1; }
    log_info "Kafka messages available: $COUNT"
fi

# Clear PostgreSQL
log_info "Clearing PostgreSQL test data..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF

# Run Flink with dynamic consumer group
export KAFKA_BROKERS="$KAFKA_BROKER"
export KAFKA_TOPIC="$KAFKA_TOPIC"
export KAFKA_GROUP_ID="$CONSUMER_GROUP"
export POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD
export ENABLE_KAFKA_PRODUCER="false"
export ENABLE_STATE_TRACKING="true"

log_info "Starting Flink..."
tmux kill-session -t flink-stream 2>/dev/null || true
./scripts/run-flink.sh &
FLINK_PID=$!
sleep 5

log_info "Waiting 60s for processing..."
sleep 60

# Check progress
for i in {1..5}; do
    TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers" 2>/dev/null | tr -d ' ')
    [ "$TRANSFER_COUNT" -gt 0 ] && { log_info "Transfers found: $TRANSFER_COUNT"; break; }
    log_warn "No data yet ($i/5), waiting 10s..."
    sleep 10
done

# Verify results
TX_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions" | tr -d ' ')

log_info "Results:"
log_info "  Transfers: $TRANSFER_COUNT (expected >= $EXPECTED_TRANSFERS)"
log_info "  Transactions: $TX_COUNT (expected >= $EXPECTED_TRANSACTIONS)"

FAILED=0
[ "$TRANSFER_COUNT" -lt "$EXPECTED_TRANSFERS" ] && { log_error "Transfer count too low"; FAILED=1; }
[ "$TX_COUNT" -lt "$EXPECTED_TRANSACTIONS" ] && { log_error "Transaction count too low"; FAILED=1; }
[ "$FAILED" -eq 0 ] && log_info "✓ Verification passed"

echo ""
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
SELECT transfer_type, COUNT(*) as count FROM chain_data.transfers GROUP BY transfer_type;
EOF

log_info "✅ Phase 2 Complete"
log_info ""
log_info "PostgreSQL populated. Phase 3 can be run repeatedly."
log_info "Next: make test-integration-phase3"

exit $FAILED
