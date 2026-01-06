#!/bin/bash
# Integration Test - Phase 1: Data Ingestion to Kafka

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
source "$SCRIPT_DIR/common.sh"
load_env "$PROJECT_ROOT" || exit 1

MOCK_SERVER_PORT=8545
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"
START_BLOCK="${START_BLOCK:-1000}"
NUM_BLOCKS="${NUM_BLOCKS:-30}"
CONFIRMATIONS=0

log_info "=== Phase 1: Data Ingestion ==="
log_info "Kafka: $KAFKA_BROKER, Blocks: $START_BLOCK-$((START_BLOCK + NUM_BLOCKS - 1))"

cleanup() {
    [ -n "$MOCK_SERVER_PID" ] && kill $MOCK_SERVER_PID 2>/dev/null || true
    [ -n "$INGESTION_PID" ] && kill $INGESTION_PID 2>/dev/null || true
}
trap cleanup EXIT

# Check Kafka
nc -z $DOCKER_HOST_IP 19092 2>/dev/null || { log_error "Cannot connect to Kafka"; exit 1; }

# Start mock server
cd "$PROJECT_ROOT/tests/integration/mock_server"
[ -f "bin/mock_server" ] || { mkdir -p bin && go build -o bin/mock_server .; }
./bin/mock_server -port $MOCK_SERVER_PORT -start-block $START_BLOCK -num-blocks $NUM_BLOCKS &
MOCK_SERVER_PID=$!
sleep 2

# Run ingestion
cd "$PROJECT_ROOT/data-ingestion"
[ -f "bin/ingestion" ] || { mkdir -p bin && go build -o bin/ingestion ./cmd/ingestion; }

ETHERSCAN_BASE_URL="http://localhost:$MOCK_SERVER_PORT/api?" \
ETHERSCAN_API_KEY="test" \
KAFKA_BROKERS="$KAFKA_BROKER" \
START_BLOCK="$START_BLOCK" \
POLL_INTERVAL_SECONDS=1 \
CONFIRMATIONS="$CONFIRMATIONS" \
./bin/ingestion &
INGESTION_PID=$!

WAIT_TIME=$((NUM_BLOCKS * 2 + 10))
log_info "Waiting ${WAIT_TIME}s..."
sleep $WAIT_TIME
kill $INGESTION_PID 2>/dev/null || true
INGESTION_PID=""

# Verify
if command -v kcat &>/dev/null; then
    COUNT=$(kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o beginning 2>/dev/null | wc -l | tr -d ' ')
    log_info "Kafka messages: $COUNT"
fi

log_info "✅ Phase 1 Complete"
log_info "Next: ./scripts/test-integration-phase2.sh"
