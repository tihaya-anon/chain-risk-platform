#!/bin/bash

# Integration Test Script for Chain Risk Platform
# This script runs the complete data pipeline with mock data
# Supports both local and remote Docker environments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root for consistent path resolution
cd "$PROJECT_ROOT"

# Source environment configuration
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    set -a  # automatically export all variables
    source "$PROJECT_ROOT/.env.local"
    set +a
fi

# Source env-remote.sh (it will use DOCKER_HOST_IP from .env.local)
if [ -f "$PROJECT_ROOT/scripts/env-remote.sh" ]; then
    source "$PROJECT_ROOT/scripts/env-remote.sh" 2>/dev/null || true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration - use environment variables from env-remote.sh
MOCK_SERVER_PORT=8545
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-localhost:19092}"
KAFKA_TOPIC="chain-transactions"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"

# Test parameters
START_BLOCK=1000
NUM_BLOCKS=30  # Must be > confirmations (12) + some buffer
CONFIRMATIONS=0  # Disable confirmations for testing
EXPECTED_TRANSFERS=$((NUM_BLOCKS * 3))  # ~3 transfers per block on average

log_info "Using Docker Host: $DOCKER_HOST_IP"
log_info "Kafka Broker: $KAFKA_BROKER"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill mock server if running
    if [ -n "$MOCK_SERVER_PID" ]; then
        kill $MOCK_SERVER_PID 2>/dev/null || true
    fi
    
    # Kill data-ingestion if running
    if [ -n "$INGESTION_PID" ]; then
        kill $INGESTION_PID 2>/dev/null || true
    fi
    
    # Kill Flink if running
    if [ -n "$FLINK_PID" ]; then
        kill $FLINK_PID 2>/dev/null || true
    fi
    
    log_info "Cleanup complete"
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        log_error "Go is not installed"
        exit 1
    fi
    
    # Check if Java is installed
    if ! command -v java &> /dev/null; then
        log_error "Java is not installed"
        exit 1
    fi
    
    # Check if Maven is installed
    if ! command -v mvn &> /dev/null; then
        log_error "Maven is not installed"
        exit 1
    fi
    
    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL client (psql) is not installed"
        exit 1
    fi
    
    # Check PostgreSQL connection
    if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
        log_error "Make sure Docker containers are running on the remote host"
        exit 1
    fi
    
    # Check Kafka connection
    if ! nc -z $DOCKER_HOST_IP 19092 2>/dev/null; then
        log_error "Cannot connect to Kafka at $DOCKER_HOST_IP:19092"
        log_error "Make sure Docker containers are running on the remote host"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Ensure Kafka topic exists by producing a test message
ensure_kafka_topic() {
    log_info "Checking if Kafka topic '$KAFKA_TOPIC' exists..."
    
    # Use kcat/kafkacat if available to check topic
    if command -v kcat &> /dev/null; then
        if kcat -b $KAFKA_BROKER -L 2>/dev/null | grep -q "$KAFKA_TOPIC"; then
            log_info "Topic '$KAFKA_TOPIC' exists"
            return 0
        else
            log_warn "Topic '$KAFKA_TOPIC' does not exist yet"
            return 1
        fi
    elif command -v kafkacat &> /dev/null; then
        if kafkacat -b $KAFKA_BROKER -L 2>/dev/null | grep -q "$KAFKA_TOPIC"; then
            log_info "Topic '$KAFKA_TOPIC' exists"
            return 0
        else
            log_warn "Topic '$KAFKA_TOPIC' does not exist yet"
            return 1
        fi
    else
        log_warn "kcat/kafkacat not installed, cannot verify topic existence"
        return 0
    fi
}

# Clear test data from database
clear_test_data() {
    log_info "Clearing test data from database..."
    
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF
    
    log_info "Test data cleared"
}

# Build mock Etherscan server
build_mock_server() {
    log_info "Building Mock Etherscan Server..."
    
    cd "$PROJECT_ROOT/tests/integration/mock_server"
    mkdir -p bin
    go build -o bin/mock_server .
    
    log_info "Mock server built: tests/integration/mock_server/bin/mock_server"
}

# Start mock Etherscan server
start_mock_server() {
    log_info "Starting Mock Etherscan Server..."
    
    cd "$PROJECT_ROOT/tests/integration/mock_server"
    
    # Build if not exists
    if [ ! -f "bin/mock_server" ]; then
        build_mock_server
    fi
    
    ./bin/mock_server -port $MOCK_SERVER_PORT -start-block $START_BLOCK -num-blocks $NUM_BLOCKS &
    MOCK_SERVER_PID=$!
    
    # Wait for server to start
    sleep 2
    
    # Verify server is running
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
    
    log_info "Data-ingestion built: data-ingestion/bin/ingestion"
}

# Run data-ingestion with mock server
run_data_ingestion() {
    log_info "Running data-ingestion service..."
    log_info "  ETHERSCAN_BASE_URL=http://localhost:$MOCK_SERVER_PORT/api?"
    log_info "  KAFKA_BROKERS=$KAFKA_BROKER"
    log_info "  START_BLOCK=$START_BLOCK"
    log_info "  CONFIRMATIONS=$CONFIRMATIONS"
    
    cd "$PROJECT_ROOT/data-ingestion"
    
    # Build if not exists
    if [ ! -f "bin/ingestion" ]; then
        build_data_ingestion
    fi
    
    # Export environment variables for the subprocess
    export ETHERSCAN_BASE_URL="http://localhost:$MOCK_SERVER_PORT/api?"
    export ETHERSCAN_API_KEY="test-api-key"
    export KAFKA_BROKERS="$KAFKA_BROKER"
    export START_BLOCK="$START_BLOCK"
    export POLL_INTERVAL_SECONDS=1
    export CONFIRMATIONS="$CONFIRMATIONS"
    
    # Run data-ingestion
    ./bin/ingestion &
    INGESTION_PID=$!
    
    log_info "Data-ingestion started (PID: $INGESTION_PID)"
    
    # Wait for data to be ingested
    WAIT_TIME=$((NUM_BLOCKS * 2 + 10))
    log_info "Waiting for data ingestion to complete (~$WAIT_TIME seconds)..."
    sleep $WAIT_TIME
    
    # Stop ingestion
    kill $INGESTION_PID 2>/dev/null || true
    INGESTION_PID=""
    
    # Verify topic was created
    cd "$PROJECT_ROOT"
    if ! ensure_kafka_topic; then
        log_error "Data ingestion failed - Kafka topic not created"
        log_error "Check data-ingestion/logs/ingestion.log for details"
        return 1
    fi
    
    log_info "Data ingestion completed"
    return 0
}

# Run Flink stream processor using run-flink.sh
run_stream_processor() {
    log_info "Running Flink stream processor..."
    
    cd "$PROJECT_ROOT"
    
    # Use the existing run-flink.sh script (it handles build and run)
    # Run in background and capture PID
    bash -c './scripts/run-flink.sh' &
    FLINK_PID=$!
    
    log_info "Stream processor started (PID: $FLINK_PID)"
    
    # Wait for processing
    log_info "Waiting for stream processing to complete..."
    sleep 30
    
    # Stop processor
    kill $FLINK_PID 2>/dev/null || true
    FLINK_PID=""
    
    log_info "Stream processing completed"
}

# Verify results in database
verify_results() {
    log_info "Verifying results in database..."
    
    # Count transfers
    TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers")
    TRANSFER_COUNT=$(echo $TRANSFER_COUNT | tr -d ' ')
    
    # Count transactions
    TX_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions")
    TX_COUNT=$(echo $TX_COUNT | tr -d ' ')
    
    # Check processing state
    PROCESSING_STATE=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT last_processed_block FROM chain_data.processing_state LIMIT 1" 2>/dev/null || echo "N/A")
    PROCESSING_STATE=$(echo $PROCESSING_STATE | tr -d ' ')
    
    log_info "Results:"
    log_info "  - Transfers: $TRANSFER_COUNT"
    log_info "  - Transactions: $TX_COUNT"
    log_info "  - Last processed block: $PROCESSING_STATE"
    
    # Validate counts
    if [ "$TRANSFER_COUNT" -lt 1 ]; then
        log_error "No transfers found in database!"
        return 1
    fi
    
    if [ "$TX_COUNT" -lt 1 ]; then
        log_warn "No transactions found in database (may be expected if sink not implemented)"
    fi
    
    log_info "Verification passed!"
    return 0
}

# Print sample data
print_sample_data() {
    log_info "Sample data from database:"
    
    echo ""
    echo "=== Sample Transfers ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT tx_hash, block_number, from_address, to_address, transfer_type, network
FROM chain_data.transfers
LIMIT 5;
EOF
    
    echo ""
    echo "=== Sample Transactions ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT hash, block_number, from_address, to_address, network
FROM chain_data.transactions
LIMIT 5;
EOF
    
    echo ""
    echo "=== Processing State ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT * FROM chain_data.processing_state;
EOF
}

# Main execution
main() {
    log_info "Starting Integration Test"
    log_info "========================="
    log_info "Docker Host: $DOCKER_HOST_IP"
    log_info "========================="
    
    check_prerequisites
    clear_test_data
    start_mock_server
    
    # Run data ingestion and check if it succeeded
    if ! run_data_ingestion; then
        log_error "Data ingestion failed, stopping test"
        exit 1
    fi
    
    run_stream_processor
    verify_results
    print_sample_data
    
    log_info "========================="
    log_info "Integration Test Complete"
}

main "$@"
