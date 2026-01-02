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
EXPECTED_TRANSACTIONS=$NUM_BLOCKS  # Expect at least NUM_BLOCKS transactions

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
    log_info "  - Transfers: $TRANSFER_COUNT (expected: >=$EXPECTED_TRANSFERS)"
    log_info "  - Transactions: $TX_COUNT (expected: >=$EXPECTED_TRANSACTIONS)"
    log_info "  - Last processed block: $PROCESSING_STATE"
    
    # Track test failures
    local TEST_FAILED=0
    
    # Validate transfer counts
    if [ "$TRANSFER_COUNT" -lt "$EXPECTED_TRANSFERS" ]; then
        log_error "Transfer count ($TRANSFER_COUNT) is less than expected ($EXPECTED_TRANSFERS)!"
        TEST_FAILED=1
    else
        log_info "✓ Transfer count validation passed"
    fi
    
    # Validate transaction counts
    if [ "$TX_COUNT" -lt "$EXPECTED_TRANSACTIONS" ]; then
        log_error "Transaction count ($TX_COUNT) is less than expected ($EXPECTED_TRANSACTIONS)!"
        TEST_FAILED=1
    else
        log_info "✓ Transaction count validation passed"
    fi
    
    # Validate processing state
    if [ "$PROCESSING_STATE" = "N/A" ] || [ -z "$PROCESSING_STATE" ]; then
        log_warn "Processing state not found in database"
    else
        EXPECTED_LAST_BLOCK=$((START_BLOCK + NUM_BLOCKS - 1))
        if [ "$PROCESSING_STATE" -ge "$EXPECTED_LAST_BLOCK" ]; then
            log_info "✓ Processing state validation passed (block: $PROCESSING_STATE)"
        else
            log_warn "Processing state ($PROCESSING_STATE) is less than expected ($EXPECTED_LAST_BLOCK)"
        fi
    fi
    
    # Data consistency checks
    log_info "Checking data consistency..."
    
    # Check if all transactions have valid block numbers
    INVALID_TX=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions WHERE block_number IS NULL OR block_number < $START_BLOCK OR block_number >= $((START_BLOCK + NUM_BLOCKS))")
    INVALID_TX=$(echo $INVALID_TX | tr -d ' ')
    
    if [ "$INVALID_TX" -gt 0 ]; then
        log_warn "Found $INVALID_TX transactions with invalid block numbers"
    else
        log_info "✓ All transactions have valid block numbers"
    fi
    
    # Check if all transfers have valid block numbers
    INVALID_TRANSFER=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers WHERE block_number IS NULL OR block_number < $START_BLOCK OR block_number >= $((START_BLOCK + NUM_BLOCKS))")
    INVALID_TRANSFER=$(echo $INVALID_TRANSFER | tr -d ' ')
    
    if [ "$INVALID_TRANSFER" -gt 0 ]; then
        log_warn "Found $INVALID_TRANSFER transfers with invalid block numbers"
    else
        log_info "✓ All transfers have valid block numbers"
    fi
    
    # Check if native transfers have corresponding transactions
    NATIVE_TRANSFERS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers WHERE transfer_type = 'native'")
    NATIVE_TRANSFERS=$(echo $NATIVE_TRANSFERS | tr -d ' ')
    
    ORPHAN_TRANSFERS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers t LEFT JOIN chain_data.transactions tx ON t.tx_hash = tx.hash WHERE tx.hash IS NULL AND t.transfer_type = 'native'")
    ORPHAN_TRANSFERS=$(echo $ORPHAN_TRANSFERS | tr -d ' ')
    
    if [ "$ORPHAN_TRANSFERS" -gt 0 ]; then
        log_warn "Found $ORPHAN_TRANSFERS native transfers without corresponding transactions"
    else
        log_info "✓ All native transfers have corresponding transactions"
    fi
    
    if [ $TEST_FAILED -eq 1 ]; then
        log_error "Verification failed!"
        return 1
    fi
    
    log_info "✅ All verifications passed!"
    return 0
}

# Print sample data
print_sample_data() {
    log_info "Sample data from database:"
    
    echo ""
    echo "=== Transfer Statistics ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    transfer_type,
    network,
    COUNT(*) as count,
    MIN(block_number) as min_block,
    MAX(block_number) as max_block
FROM chain_data.transfers
GROUP BY transfer_type, network
ORDER BY transfer_type, network;
EOF
    
    echo ""
    echo "=== Transaction Statistics ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    network,
    COUNT(*) as count,
    MIN(block_number) as min_block,
    MAX(block_number) as max_block,
    COUNT(CASE WHEN is_error THEN 1 END) as error_count
FROM chain_data.transactions
GROUP BY network
ORDER BY network;
EOF
    
    echo ""
    echo "=== Sample Transfers ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    tx_hash, 
    block_number, 
    from_address, 
    to_address, 
    transfer_type, 
    token_symbol,
    network
FROM chain_data.transfers
ORDER BY block_number DESC
LIMIT 5;
EOF
    
    echo ""
    echo "=== Sample Transactions ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    hash, 
    block_number, 
    from_address, 
    to_address, 
    value,
    is_error,
    network
FROM chain_data.transactions
ORDER BY block_number DESC
LIMIT 5;
EOF
    
    echo ""
    echo "=== Processing State ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    id,
    network,
    processor_type,
    last_processed_block,
    updated_at
FROM chain_data.processing_state
ORDER BY network, processor_type;
EOF
    
    echo ""
    echo "=== Data Integrity Check ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
-- Check for native transfers without transactions
SELECT 
    'Native transfers without transactions' as check_type,
    COUNT(*) as count
FROM chain_data.transfers t
LEFT JOIN chain_data.transactions tx ON t.tx_hash = tx.hash
WHERE tx.hash IS NULL AND t.transfer_type = 'native'
UNION ALL
-- Check for transactions without any transfers
SELECT 
    'Transactions without transfers' as check_type,
    COUNT(*) as count
FROM chain_data.transactions tx
LEFT JOIN chain_data.transfers t ON tx.hash = t.tx_hash
WHERE t.tx_hash IS NULL;
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
