#!/bin/bash

# Integration Test Script for Chain Risk Platform (Lambda Architecture)
# This script runs the complete data pipeline with mock data
# Tests: data-ingestion → Kafka → Flink (dual-write) → PostgreSQL + Neo4j

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
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"
KAFKA_TRANSFERS_TOPIC="transfers"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"

# Neo4j configuration
NEO4J_HOST="${NEO4J_HOST:-$DOCKER_HOST_IP}"
NEO4J_BOLT_PORT="${NEO4J_BOLT_PORT:-17687}"
NEO4J_HTTP_PORT="${NEO4J_HTTP_PORT:-17474}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"
NEO4J_URI="bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT"

# Test parameters
START_BLOCK=1000
NUM_BLOCKS=30  # Must be > confirmations (12) + some buffer
CONFIRMATIONS=0  # Disable confirmations for testing
EXPECTED_TRANSFERS=$((NUM_BLOCKS * 3))  # ~3 transfers per block on average
EXPECTED_TRANSACTIONS=$NUM_BLOCKS  # Expect at least NUM_BLOCKS transactions

# Feature flags
ENABLE_NEO4J_SINK="${ENABLE_NEO4J_SINK:-true}"
ENABLE_KAFKA_PRODUCER="${ENABLE_KAFKA_PRODUCER:-true}"
ENABLE_STATE_TRACKING="${ENABLE_STATE_TRACKING:-true}"

log_info "Using Docker Host: $DOCKER_HOST_IP"
log_info "Kafka Broker: $KAFKA_BROKER"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Neo4j: $NEO4J_URI"
log_info "Neo4j Sink Enabled: $ENABLE_NEO4J_SINK"
log_info "Kafka Producer Enabled: $ENABLE_KAFKA_PRODUCER"

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
    
    # Kill Flink if running (tmux or direct)
    if command -v tmux &> /dev/null && tmux has-session -t flink-stream 2>/dev/null; then
        tmux kill-session -t flink-stream 2>/dev/null || true
    fi
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
    
    # Check Neo4j connection (optional - warn only)
    if [ "$ENABLE_NEO4J_SINK" = "true" ]; then
        if ! nc -z $NEO4J_HOST $NEO4J_BOLT_PORT 2>/dev/null; then
            log_warn "Cannot connect to Neo4j at $NEO4J_HOST:$NEO4J_BOLT_PORT"
            log_warn "Neo4j verification will be skipped"
            ENABLE_NEO4J_SINK="false"
        else
            # Try to verify Neo4j HTTP endpoint
            if curl -s -u "$NEO4J_USER:$NEO4J_PASSWORD" "http://$NEO4J_HOST:$NEO4J_HTTP_PORT" > /dev/null 2>&1; then
                log_info "Neo4j connection verified"
            else
                log_warn "Neo4j HTTP endpoint not accessible, verification will be limited"
            fi
        fi
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
    log_info "Clearing test data from PostgreSQL..."
    
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF
    
    log_info "PostgreSQL test data cleared"
    
    # Clear Neo4j data (optional)
    if [ "$ENABLE_NEO4J_SINK" = "true" ]; then
        log_info "Clearing test data from Neo4j..."
        
        # Use cypher-shell if available
        if command -v cypher-shell &> /dev/null; then
            cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
                "MATCH (n) DETACH DELETE n" 2>/dev/null || log_warn "Failed to clear Neo4j data (cypher-shell)"
        else
            log_warn "cypher-shell not installed, skipping Neo4j data cleanup"
            log_warn "Install with: brew install cypher-shell (macOS) or apt-get install cypher-shell (Linux)"
        fi
    fi
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

# Run Flink stream processor with Lambda Architecture dual-write
run_stream_processor() {
    log_info "Running Flink stream processor (Lambda Speed Layer)..."
    log_info "  Kafka Brokers: $KAFKA_BROKER"
    log_info "  Neo4j URI: $NEO4J_URI"
    log_info "  Neo4j Sink: $ENABLE_NEO4J_SINK"
    log_info "  Kafka Producer: $ENABLE_KAFKA_PRODUCER"
    
    cd "$PROJECT_ROOT"
    
    # Export all configuration for Flink
    export KAFKA_BROKERS="$KAFKA_BROKER"
    export KAFKA_TOPIC="$KAFKA_TOPIC"
    export KAFKA_GROUP_ID="stream-processor"
    export KAFKA_TRANSFERS_TOPIC="$KAFKA_TRANSFERS_TOPIC"
    export POSTGRES_HOST="$POSTGRES_HOST"
    export POSTGRES_PORT="$POSTGRES_PORT"
    export POSTGRES_DB="$POSTGRES_DB"
    export POSTGRES_USER="$POSTGRES_USER"
    export POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
    export NEO4J_URI="$NEO4J_URI"
    export NEO4J_USER="$NEO4J_USER"
    export NEO4J_PASSWORD="$NEO4J_PASSWORD"
    export ENABLE_NEO4J_SINK="$ENABLE_NEO4J_SINK"
    export ENABLE_KAFKA_PRODUCER="$ENABLE_KAFKA_PRODUCER"
    export ENABLE_STATE_TRACKING="$ENABLE_STATE_TRACKING"
    
    # Run Flink in background (will use tmux if available)
    if command -v tmux &> /dev/null; then
        log_info "Starting Flink in tmux session..."
        # Kill existing session if exists
        tmux kill-session -t flink-stream 2>/dev/null || true
        
        # Start Flink in tmux (run-flink.sh will detect tmux)
        ./scripts/run-flink.sh &
        FLINK_PID=$!
        
        # Wait a bit for tmux session to start
        sleep 5
        
        log_info "Flink started in tmux session 'flink-stream'"
    else
        log_warn "tmux not available, running Flink in background"
        ./scripts/run-flink.sh &
        FLINK_PID=$!
    fi
    
    # Wait for processing
    log_info "Waiting for stream processing to complete..."
    
    # Wait longer for Flink to start and process data
    log_info "Waiting 60 seconds for Flink to process data..."
    sleep 60
    
    # Check if data is being processed (retry logic)
    log_info "Checking if data is being processed..."
    for i in {1..5}; do
        TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers" 2>/dev/null | tr -d ' ')
        if [ "$TRANSFER_COUNT" -gt 0 ]; then
            log_info "Data found! Transfer count: $TRANSFER_COUNT"
            break
        fi
        log_warn "No data yet (attempt $i/5), waiting 10 more seconds..."
        sleep 10
    done
    
    log_info "Stream processing completed"
}

# Verify results in PostgreSQL
verify_postgresql_results() {
    log_info "Verifying results in PostgreSQL..."
    
    # Count transfers
    TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers")
    TRANSFER_COUNT=$(echo $TRANSFER_COUNT | tr -d ' ')
    
    # Count transactions
    TX_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions")
    TX_COUNT=$(echo $TX_COUNT | tr -d ' ')
    
    # Check processing state
    PROCESSING_STATE=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT last_processed_block FROM chain_data.processing_state LIMIT 1" 2>/dev/null || echo "N/A")
    PROCESSING_STATE=$(echo $PROCESSING_STATE | tr -d ' ')
    
    log_info "PostgreSQL Results:"
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
    
    return $TEST_FAILED
}

# Verify results in Neo4j (optional)
verify_neo4j_results() {
    if [ "$ENABLE_NEO4J_SINK" != "true" ]; then
        log_info "Neo4j verification skipped (sink disabled)"
        return 0
    fi
    
    log_info "Verifying results in Neo4j..."
    
    if ! command -v cypher-shell &> /dev/null; then
        log_warn "cypher-shell not installed, skipping Neo4j verification"
        log_warn "Install with: brew install cypher-shell (macOS)"
        return 0
    fi
    
    # Count Address nodes
    ADDRESS_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH (a:Address) RETURN count(a) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    # Count TRANSFER relationships
    TRANSFER_REL_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER]->() RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    # Count stream-sourced data
    STREAM_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER {source: 'stream'}]->() RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    log_info "Neo4j Results:"
    log_info "  - Address nodes: $ADDRESS_COUNT"
    log_info "  - TRANSFER relationships: $TRANSFER_REL_COUNT"
    log_info "  - Stream-sourced transfers: $STREAM_COUNT"
    
    # Validate Neo4j data
    if [ "$ADDRESS_COUNT" -gt 0 ] && [ "$TRANSFER_REL_COUNT" -gt 0 ]; then
        log_info "✓ Neo4j dual-write validation passed"
        
        # Check if all transfers are marked as stream
        if [ "$STREAM_COUNT" -eq "$TRANSFER_REL_COUNT" ]; then
            log_info "✓ All transfers correctly marked with source='stream'"
        else
            log_warn "Some transfers not marked with source='stream' ($STREAM_COUNT/$TRANSFER_REL_COUNT)"
        fi
        
        return 0
    else
        log_warn "Neo4j data validation failed (Address: $ADDRESS_COUNT, Transfers: $TRANSFER_REL_COUNT)"
        return 1
    fi
}

# Print sample data
print_sample_data() {
    log_info "Sample data from PostgreSQL:"
    
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
    
    # Print Neo4j sample data if available
    if [ "$ENABLE_NEO4J_SINK" = "true" ] && command -v cypher-shell &> /dev/null; then
        echo ""
        echo "=== Neo4j Sample Data ==="
        cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
            "MATCH (from:Address)-[r:TRANSFER]->(to:Address) RETURN from.address, to.address, r.amount, r.source LIMIT 5" \
            --format plain 2>/dev/null || log_warn "Failed to query Neo4j sample data"
    fi
}

# Main execution
main() {
    log_info "Starting Integration Test (Lambda Architecture)"
    log_info "================================================"
    log_info "Docker Host: $DOCKER_HOST_IP"
    log_info "Testing: data-ingestion → Kafka → Flink → PostgreSQL + Neo4j"
    log_info "================================================"
    
    check_prerequisites
    clear_test_data
    start_mock_server
    
    # Run data ingestion and check if it succeeded
    if ! run_data_ingestion; then
        log_error "Data ingestion failed, stopping test"
        exit 1
    fi
    
    run_stream_processor
    
    # Verify PostgreSQL results
    if ! verify_postgresql_results; then
        log_error "PostgreSQL verification failed"
        exit 1
    fi
    
    # Verify Neo4j results (optional)
    verify_neo4j_results || log_warn "Neo4j verification had issues (non-fatal)"
    
    print_sample_data
    
    log_info "================================================"
    log_info "✅ Integration Test Complete"
    log_info "================================================"
}

main "$@"
