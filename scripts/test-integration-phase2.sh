#!/bin/bash

# Integration Test - Phase 2: Flink Processing (Kafka → PostgreSQL + Neo4j)
# This script can be run multiple times to test Flink without re-ingesting data
# Uses dynamic consumer group to consume from beginning each time

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
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="chain-transactions"
KAFKA_TRANSFERS_TOPIC="transfers"

# Use dynamic consumer group with timestamp to consume from beginning each time
CONSUMER_GROUP="stream-processor-test-$(date +%s)"

POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"

NEO4J_HOST="${NEO4J_HOST:-$DOCKER_HOST_IP}"
NEO4J_BOLT_PORT="${NEO4J_BOLT_PORT:-17687}"
NEO4J_HTTP_PORT="${NEO4J_HTTP_PORT:-17474}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"
NEO4J_URI="bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT"

# Test parameters
START_BLOCK="${START_BLOCK:-1000}"
NUM_BLOCKS="${NUM_BLOCKS:-30}"
EXPECTED_TRANSFERS=$((NUM_BLOCKS * 3))
EXPECTED_TRANSACTIONS=$NUM_BLOCKS

# Feature flags
ENABLE_NEO4J_SINK="${ENABLE_NEO4J_SINK:-true}"
ENABLE_KAFKA_PRODUCER="${ENABLE_KAFKA_PRODUCER:-true}"
ENABLE_STATE_TRACKING="${ENABLE_STATE_TRACKING:-true}"

log_info "=== Integration Test - Phase 2: Flink Processing ==="
log_info "Docker Host: $DOCKER_HOST_IP"
log_info "Kafka Broker: $KAFKA_BROKER"
log_info "Consumer Group: $CONSUMER_GROUP (dynamic, will read from beginning)"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Neo4j: $NEO4J_URI"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill Flink if running
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
    
    if ! command -v java &> /dev/null; then
        log_error "Java is not installed"
        exit 1
    fi
    
    if ! command -v mvn &> /dev/null; then
        log_error "Maven is not installed"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL client (psql) is not installed"
        exit 1
    fi
    
    if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
        exit 1
    fi
    
    if ! nc -z $DOCKER_HOST_IP 19092 2>/dev/null; then
        log_error "Cannot connect to Kafka at $DOCKER_HOST_IP:19092"
        exit 1
    fi
    
    if [ "$ENABLE_NEO4J_SINK" = "true" ]; then
        if ! nc -z $NEO4J_HOST $NEO4J_BOLT_PORT 2>/dev/null; then
            log_warn "Cannot connect to Neo4j at $NEO4J_HOST:$NEO4J_BOLT_PORT"
            log_warn "Neo4j verification will be skipped"
            ENABLE_NEO4J_SINK="false"
        fi
    fi
    
    log_info "Prerequisites check passed"
}

# Verify Kafka has data
verify_kafka_has_data() {
    log_info "Checking if Kafka has test data..."
    
    if command -v kcat &> /dev/null; then
        MESSAGE_COUNT=$(kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o beginning 2>/dev/null | wc -l | tr -d ' ')
        log_info "Messages in Kafka topic '$KAFKA_TOPIC': $MESSAGE_COUNT"
        
        if [ "$MESSAGE_COUNT" -eq 0 ]; then
            log_error "No data in Kafka! Please run Phase 1 first:"
            log_error "  ./scripts/test-integration-phase1.sh"
            exit 1
        fi
        
        log_info "✓ Kafka has data"
    else
        log_warn "kcat not installed, skipping Kafka data check"
    fi
}

# Clear test data from databases
clear_test_data() {
    log_info "Clearing test data from PostgreSQL..."
    
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF
    
    log_info "PostgreSQL test data cleared"
    
    if [ "$ENABLE_NEO4J_SINK" = "true" ]; then
        log_info "Clearing test data from Neo4j..."
        
        if command -v cypher-shell &> /dev/null; then
            cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
                "MATCH (n) DETACH DELETE n" 2>/dev/null || log_warn "Failed to clear Neo4j data"
        else
            log_warn "cypher-shell not installed, skipping Neo4j data cleanup"
        fi
    fi
}

# Run Flink stream processor
run_stream_processor() {
    log_info "Running Flink stream processor..."
    log_info "  Consumer Group: $CONSUMER_GROUP (dynamic)"
    log_info "  Kafka Brokers: $KAFKA_BROKER"
    log_info "  Neo4j Sink: $ENABLE_NEO4J_SINK"
    log_info "  Kafka Producer: $ENABLE_KAFKA_PRODUCER"
    
    cd "$PROJECT_ROOT"
    
    # Export configuration for Flink
    export KAFKA_BROKERS="$KAFKA_BROKER"
    export KAFKA_TOPIC="$KAFKA_TOPIC"
    export KAFKA_GROUP_ID="$CONSUMER_GROUP"  # Dynamic group ID
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
    
    # Run Flink in background
    if command -v tmux &> /dev/null; then
        log_info "Starting Flink in tmux session..."
        tmux kill-session -t flink-stream 2>/dev/null || true
        
        ./scripts/run-flink.sh &
        FLINK_PID=$!
        
        sleep 5
        log_info "Flink started in tmux session 'flink-stream'"
    else
        log_warn "tmux not available, running Flink in background"
        ./scripts/run-flink.sh &
        FLINK_PID=$!
    fi
    
    # Wait for processing with retry logic
    log_info "Waiting for stream processing to complete..."
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

# Verify PostgreSQL results
verify_postgresql_results() {
    log_info "Verifying results in PostgreSQL..."
    
    TRANSFER_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transfers" | tr -d ' ')
    TX_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM chain_data.transactions" | tr -d ' ')
    PROCESSING_STATE=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT last_processed_block FROM chain_data.processing_state LIMIT 1" 2>/dev/null | tr -d ' ')
    
    log_info "PostgreSQL Results:"
    log_info "  - Transfers: $TRANSFER_COUNT (expected: >=$EXPECTED_TRANSFERS)"
    log_info "  - Transactions: $TX_COUNT (expected: >=$EXPECTED_TRANSACTIONS)"
    log_info "  - Last processed block: ${PROCESSING_STATE:-N/A}"
    
    local TEST_FAILED=0
    
    if [ "$TRANSFER_COUNT" -lt "$EXPECTED_TRANSFERS" ]; then
        log_error "Transfer count ($TRANSFER_COUNT) is less than expected ($EXPECTED_TRANSFERS)!"
        TEST_FAILED=1
    else
        log_info "✓ Transfer count validation passed"
    fi
    
    if [ "$TX_COUNT" -lt "$EXPECTED_TRANSACTIONS" ]; then
        log_error "Transaction count ($TX_COUNT) is less than expected ($EXPECTED_TRANSACTIONS)!"
        TEST_FAILED=1
    else
        log_info "✓ Transaction count validation passed"
    fi
    
    return $TEST_FAILED
}

# Verify Neo4j results
verify_neo4j_results() {
    if [ "$ENABLE_NEO4J_SINK" != "true" ]; then
        log_info "Neo4j verification skipped (sink disabled)"
        return 0
    fi
    
    log_info "Verifying results in Neo4j..."
    
    if ! command -v cypher-shell &> /dev/null; then
        log_warn "cypher-shell not installed, skipping Neo4j verification"
        return 0
    fi
    
    ADDRESS_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH (a:Address) RETURN count(a) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    TRANSFER_REL_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER]->() RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    STREAM_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER {source: 'stream'}]->() RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    log_info "Neo4j Results:"
    log_info "  - Address nodes: $ADDRESS_COUNT"
    log_info "  - TRANSFER relationships: $TRANSFER_REL_COUNT"
    log_info "  - Stream-sourced transfers: $STREAM_COUNT"
    
    if [ "$ADDRESS_COUNT" -gt 0 ] && [ "$TRANSFER_REL_COUNT" -gt 0 ]; then
        log_info "✓ Neo4j dual-write validation passed"
        
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
    echo "=== Sample Transfers ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    tx_hash, 
    block_number, 
    from_address, 
    to_address, 
    transfer_type, 
    token_symbol
FROM chain_data.transfers
ORDER BY block_number DESC
LIMIT 5;
EOF
}

# Main execution
main() {
    log_info "================================================"
    log_info "Phase 2: Flink Processing (Kafka → DB)"
    log_info "================================================"
    
    check_prerequisites
    verify_kafka_has_data
    clear_test_data
    run_stream_processor
    
    if ! verify_postgresql_results; then
        log_error "PostgreSQL verification failed"
        exit 1
    fi
    
    verify_neo4j_results || log_warn "Neo4j verification had issues (non-fatal)"
    
    print_sample_data
    
    log_info "================================================"
    log_info "✅ Phase 2 Complete"
    log_info "================================================"
    log_info ""
    log_info "Consumer Group Used: $CONSUMER_GROUP"
    log_info "This group will not interfere with production consumers"
    log_info ""
    log_info "To run again:"
    log_info "  ./scripts/test-integration-phase2.sh"
    log_info ""
    log_info "To re-ingest data:"
    log_info "  ./scripts/test-integration-phase1.sh"
}

main "$@"
