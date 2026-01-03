#!/bin/bash

# Integration Test - Phase 1: Data Ingestion to Kafka
# This script only needs to run once to populate Kafka with test data
# Use this when you modify data-ingestion or want fresh test data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Source environment configuration
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    set -a
    source "$PROJECT_ROOT/.env.local"
    set +a
fi

if [ -f "$PROJECT_ROOT/scripts/env-remote.sh" ]; then
    source "$PROJECT_ROOT/scripts/env-remote.sh" 2>/dev/null || true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
MOCK_SERVER_PORT=8545
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"

# Test parameters
START_BLOCK="${START_BLOCK:-1000}"
NUM_BLOCKS="${NUM_BLOCKS:-30}"
CONFIRMATIONS=0

log_info "=== Integration Test - Phase 1: Data Ingestion ==="
log_info "Docker Host: $DOCKER_HOST_IP"
log_info "Kafka Broker: $KAFKA_BROKER"
log_info "Start Block: $START_BLOCK"
log_info "Num Blocks: $NUM_BLOCKS"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ -n "$MOCK_SERVER_PID" ]; then
        kill $MOCK_SERVER_PID 2>/dev/null || true
    fi
    if [ -n "$INGESTION_PID" ]; then
        kill $INGESTION_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v go &> /dev/null; then
        log_error "Go is not installed"
        exit 1
    fi
    
    if ! nc -z $DOCKER_HOST_IP 19092 2>/dev/null; then
        log_error "Cannot connect to Kafka at $DOCKER_HOST_IP:19092"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build mock server
build_mock_server() {
    log_info "Building Mock Etherscan Server..."
    cd "$PROJECT_ROOT/tests/integration/mock_server"
    mkdir -p bin
    go build -o bin/mock_server .
}

# Start mock server
start_mock_server() {
    log_info "Starting Mock Etherscan Server..."
    cd "$PROJECT_ROOT/tests/integration/mock_server"
    
    if [ ! -f "bin/mock_server" ]; then
        build_mock_server
    fi
    
    ./bin/mock_server -port $MOCK_SERVER_PORT -start-block $START_BLOCK -num-blocks $NUM_BLOCKS &
    MOCK_SERVER_PID=$!
    
    sleep 2
    
    if ! curl -s "http://localhost:$MOCK_SERVER_PORT/api?module=proxy&action=eth_blockNumber" > /dev/null; then
        log_error "Mock server failed to start"
        exit 1
    fi
    
    log_info "Mock Etherscan Server started (PID: $MOCK_SERVER_PID)"
}

# Build data-ingestion
build_data_ingestion() {
    log_info "Building data-ingestion..."
    cd "$PROJECT_ROOT/data-ingestion"
    mkdir -p bin
    go build -o bin/ingestion ./cmd/ingestion
}

# Run data-ingestion
run_data_ingestion() {
    log_info "Running data-ingestion service..."
    log_info "  ETHERSCAN_BASE_URL=http://localhost:$MOCK_SERVER_PORT/api?"
    log_info "  KAFKA_BROKERS=$KAFKA_BROKER"
    log_info "  START_BLOCK=$START_BLOCK"
    log_info "  NUM_BLOCKS=$NUM_BLOCKS"
    
    cd "$PROJECT_ROOT/data-ingestion"
    
    if [ ! -f "bin/ingestion" ]; then
        build_data_ingestion
    fi
    
    export ETHERSCAN_BASE_URL="http://localhost:$MOCK_SERVER_PORT/api?"
    export ETHERSCAN_API_KEY="test-api-key"
    export KAFKA_BROKERS="$KAFKA_BROKER"
    export START_BLOCK="$START_BLOCK"
    export POLL_INTERVAL_SECONDS=1
    export CONFIRMATIONS="$CONFIRMATIONS"
    
    ./bin/ingestion &
    INGESTION_PID=$!
    
    log_info "Data-ingestion started (PID: $INGESTION_PID)"
    
    # Wait for ingestion to complete
    WAIT_TIME=$((NUM_BLOCKS * 2 + 10))
    log_info "Waiting for data ingestion to complete (~$WAIT_TIME seconds)..."
    sleep $WAIT_TIME
    
    # Stop ingestion
    kill $INGESTION_PID 2>/dev/null || true
    INGESTION_PID=""
    
    log_info "Data ingestion completed"
}

# Verify Kafka data
verify_kafka_data() {
    log_info "Verifying Kafka data..."
    
    if command -v kcat &> /dev/null; then
        MESSAGE_COUNT=$(kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o beginning 2>/dev/null | wc -l | tr -d ' ')
        log_info "Messages in Kafka topic '$KAFKA_TOPIC': $MESSAGE_COUNT"
        
        if [ "$MESSAGE_COUNT" -lt "$NUM_BLOCKS" ]; then
            log_warn "Expected at least $NUM_BLOCKS messages, got $MESSAGE_COUNT"
        else
            log_info "✓ Kafka data verification passed"
        fi
        
        # Show sample message
        log_info "Sample message:"
        kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o beginning -c 1 2>/dev/null | jq -r '.network, .blockNumber' | head -2
    else
        log_warn "kcat not installed, skipping Kafka verification"
        log_warn "Install with: brew install kcat (macOS)"
    fi
}

# Main execution
main() {
    log_info "================================================"
    log_info "Phase 1: Data Ingestion to Kafka"
    log_info "================================================"
    
    check_prerequisites
    start_mock_server
    run_data_ingestion
    verify_kafka_data
    
    log_info "================================================"
    log_info "✅ Phase 1 Complete"
    log_info "================================================"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Run Phase 2 to test Flink processing:"
    log_info "     ./scripts/test-integration-phase2.sh"
    log_info ""
    log_info "  2. Or run full test:"
    log_info "     make test-integration"
    log_info ""
    log_info "Kafka topic '$KAFKA_TOPIC' now contains $NUM_BLOCKS blocks of test data"
    log_info "You can run Phase 2 multiple times without re-running Phase 1"
}

main "$@"
