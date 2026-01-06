#!/bin/bash
# Integration Test - Full Pipeline
# data-ingestion → Kafka → Flink → PostgreSQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
source "$SCRIPT_DIR/common.sh"
load_env "$PROJECT_ROOT" || exit 1

# Configuration
MOCK_SERVER_PORT=8545
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"

START_BLOCK=1000
NUM_BLOCKS=30
CONFIRMATIONS=0
EXPECTED_TRANSFERS=$((NUM_BLOCKS * 3))
EXPECTED_TRANSACTIONS=$NUM_BLOCKS

log_info "=== Integration Test (Full Pipeline) ==="
log_info "Kafka: $KAFKA_BROKER"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"

cleanup() {
    log_info "Cleaning up..."
    [ -n "$MOCK_SERVER_PID" ] && kill $MOCK_SERVER_PID 2>/dev/null || true
    [ -n "$INGESTION_PID" ] && kill $INGESTION_PID 2>/dev/null || true
    command -v tmux &>/dev/null && tmux kill-session -t flink-stream 2>/dev/null || true
    [ -n "$FLINK_PID" ] && kill $FLINK_PID 2>/dev/null || true
}
trap cleanup EXIT

check_prerequisites() {
    log_info "Checking prerequisites..."
    command -v go &>/dev/null || { log_error "Go not installed"; exit 1; }
    command -v java &>/dev/null || { log_error "Java not installed"; exit 1; }
    command -v mvn &>/dev/null || { log_error "Maven not installed"; exit 1; }
    command -v psql &>/dev/null || { log_error "psql not installed"; exit 1; }
    
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" >/dev/null 2>&1 \
        || { log_error "Cannot connect to PostgreSQL"; exit 1; }
    nc -z $DOCKER_HOST_IP 19092 2>/dev/null || { log_error "Cannot connect to Kafka"; exit 1; }
    log_info "Prerequisites OK"
}

clear_test_data() {
    log_info "Clearing test data..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF
}

start_mock_server() {
    log_info "Starting mock server..."
    cd "$PROJECT_ROOT/tests/integration/mock_server"
    [ -f "bin/mock_server" ] || { mkdir -p bin && go build -o bin/mock_server .; }
    ./bin/mock_server -port $MOCK_SERVER_PORT -start-block $START_BLOCK -num-blocks $NUM_BLOCKS &
    MOCK_SERVER_PID=$!
    sleep 2
    curl -s "http://localhost:$MOCK_SERVER_PORT/api?module=proxy&action=eth_blockNumber" >/dev/null \
        || { log_error "Mock server failed"; exit 1; }
    log_info "Mock server started (PID: $MOCK_SERVER_PID)"
}

run_data_ingestion() {
    log_info "Running data-ingestion..."
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
    log_info "Waiting ${WAIT_TIME}s for ingestion..."
    sleep $WAIT_TIME
    kill $INGESTION_PID 2>/dev/null || true
    INGESTION_PID=""
}

run_stream_processor() {
    log_info "Running Flink..."
    cd "$PROJECT_ROOT"
    
    export KAFKA_BROKERS="$KAFKA_BROKER"
    export KAFKA_TOPIC="$KAFKA_TOPIC"
    export KAFKA_GROUP_ID="stream-processor"
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
        COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers" 2>/dev/null | tr -d ' ')
        [ "$COUNT" -gt 0 ] && { log_info "Found $COUNT transfers"; break; }
        log_warn "No data yet ($i/5), waiting 10s..."
        sleep 10
    done
}

verify_results() {
    log_info "Verifying results..."
    
    TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers" | tr -d ' ')
    TX_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions" | tr -d ' ')
    
    log_info "Results: Transfers=$TRANSFER_COUNT (expected >=$EXPECTED_TRANSFERS), Transactions=$TX_COUNT (expected >=$EXPECTED_TRANSACTIONS)"
    
    local FAILED=0
    [ "$TRANSFER_COUNT" -lt "$EXPECTED_TRANSFERS" ] && { log_error "Transfer count too low"; FAILED=1; }
    [ "$TX_COUNT" -lt "$EXPECTED_TRANSACTIONS" ] && { log_error "Transaction count too low"; FAILED=1; }
    [ "$FAILED" -eq 0 ] && log_info "✓ Verification passed"
    return $FAILED
}

print_sample() {
    echo ""
    echo "=== Sample Transfers ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
SELECT tx_hash, block_number, from_address, to_address, transfer_type, token_symbol
FROM chain_data.transfers ORDER BY block_number DESC LIMIT 5;
EOF
}

main() {
    check_prerequisites
    clear_test_data
    start_mock_server
    run_data_ingestion
    run_stream_processor
    verify_results || exit 1
    print_sample
    log_info "✅ Integration Test Complete"
}

main "$@"
