#!/bin/bash
# Integration Test - Phase 1: Data Ingestion to Kafka
# Run once to populate Kafka with test data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$PROJECT_ROOT"
source "$PROJECT_ROOT/scripts/common.sh"
load_env "$PROJECT_ROOT" || exit 1

MOCK_SERVER_PORT=8545
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"

# Use real fixture blocks (24154086-24154088) instead of generated mock data
# This ensures we have real transaction data with proper addresses
START_BLOCK="${START_BLOCK:-24154086}"
NUM_BLOCKS="${NUM_BLOCKS:-3}"
CONFIRMATIONS=0

log_info "=== Phase 1: Data Ingestion ==="
log_info "Kafka: $KAFKA_BROKER, Blocks: $START_BLOCK-$((START_BLOCK + NUM_BLOCKS - 1))"

cleanup() {
    [ -n "$MOCK_SERVER_PID" ] && kill $MOCK_SERVER_PID 2>/dev/null || true
    [ -n "$INGESTION_PID" ] && kill $INGESTION_PID 2>/dev/null || true
}
trap cleanup EXIT

# Check Kafka
nc -z ${KAFKA_BROKER%:*} ${KAFKA_BROKER#*:} 2>/dev/null || { log_error "Cannot connect to Kafka at $KAFKA_BROKER"; exit 1; }

# Start mock server (will use real fixtures for blocks 24154086-24154088)
log_info "Starting mock server..."
cd "$PROJECT_ROOT/tests/integration/mock_server"
[ -f "bin/mock_server" ] || { mkdir -p bin && go build -o bin/mock_server .; }
./bin/mock_server -port $MOCK_SERVER_PORT -fallback=false &
MOCK_SERVER_PID=$!
sleep 2
curl -s "http://localhost:$MOCK_SERVER_PORT/api?module=proxy&action=eth_blockNumber" >/dev/null || { log_error "Mock server failed"; exit 1; }

# Run ingestion
log_info "Running data-ingestion..."
cd "$PROJECT_ROOT/data-ingestion"
[ -f "bin/ingestion" ] || { mkdir -p bin && go build -o bin/ingestion ./cmd/ingestion; }

ETHERSCAN_BASE_URL="http://localhost:$MOCK_SERVER_PORT/api?" \
ETHERSCAN_API_KEY="test" \
KAFKA_BROKERS="$KAFKA_BROKER" \
START_BLOCK="$START_BLOCK" \
CONFIRMATIONS="$CONFIRMATIONS" \
NETWORK="ethereum" \
./bin/ingestion &
INGESTION_PID=$!

# Wait for ingestion (3 real blocks should process quickly)
log_info "Waiting 30s for processing..."
sleep 30
kill $INGESTION_PID 2>/dev/null || true
kill $MOCK_SERVER_PID 2>/dev/null || true

# Verify Kafka
KAFKA_COUNT=$(kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -q 2>/dev/null | wc -l | tr -d ' ')
log_info "Kafka messages: $KAFKA_COUNT"

if [ "$KAFKA_COUNT" -ge 3 ]; then
    log_info "✅ Phase 1 Complete"
    log_info ""
    log_info "Kafka topic '$KAFKA_TOPIC' populated with real fixture data."
    log_info "Next: make test-integration-phase2"
else
    log_error "❌ Phase 1 Failed - expected >= 3 messages, got $KAFKA_COUNT"
    exit 1
fi
