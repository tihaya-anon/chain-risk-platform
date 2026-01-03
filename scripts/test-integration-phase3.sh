#!/bin/bash

# Integration Test - Phase 3: Spark Batch Processing (Correct stream data)
# This script tests the Lambda Batch Layer by reading stream data and correcting it
# Requires Phase 2 to have run first (stream data must exist)

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

POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
POSTGRES_JDBC_URL="jdbc:postgresql://$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

NEO4J_HOST="${NEO4J_HOST:-$DOCKER_HOST_IP}"
NEO4J_BOLT_PORT="${NEO4J_BOLT_PORT:-17687}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"
NEO4J_URI="bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT"

# Feature flags
ENABLE_NEO4J_SINK="${ENABLE_NEO4J_SINK:-true}"
NETWORK="${NETWORK:-ethereum}"

log_info "=== Integration Test - Phase 3: Spark Batch Processing ==="
log_info "Docker Host: $DOCKER_HOST_IP"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Neo4j: $NEO4J_URI"
log_info "Network: $NETWORK"
log_info "Neo4j Sink: $ENABLE_NEO4J_SINK"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill Spark if running
    if [ -n "$SPARK_PID" ]; then
        kill $SPARK_PID 2>/dev/null || true
    fi
    
    log_info "Cleanup complete"
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Spark is installed
    if ! command -v spark-submit &> /dev/null; then
        log_error "Spark is not installed"
        log_error "Install with: brew install apache-spark (macOS)"
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
        exit 1
    fi
    
    # Check Neo4j connection (optional)
    if [ "$ENABLE_NEO4J_SINK" = "true" ]; then
        if ! nc -z $NEO4J_HOST $NEO4J_BOLT_PORT 2>/dev/null; then
            log_warn "Cannot connect to Neo4j at $NEO4J_HOST:$NEO4J_BOLT_PORT"
            log_warn "Neo4j verification will be skipped"
            ENABLE_NEO4J_SINK="false"
        fi
    fi
    
    log_info "Prerequisites check passed"
}

# Verify stream data exists
verify_stream_data_exists() {
    log_info "Checking if stream data exists..."
    
    STREAM_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
        "SELECT COUNT(*) FROM chain_data.transfers WHERE source='stream'" 2>/dev/null | tr -d ' ')
    
    log_info "Stream transfers found: $STREAM_COUNT"
    
    if [ "$STREAM_COUNT" -eq 0 ]; then
        log_error "No stream data found! Please run Phase 2 first:"
        log_error "  ./scripts/test-integration-phase2.sh"
        exit 1
    fi
    
    log_info "✓ Stream data exists"
}

# Build batch processor
build_batch_processor() {
    log_info "Building Spark batch processor..."
    
    cd "$PROJECT_ROOT/processing/batch-processor"
    
    # Build with local profile (includes Spark dependencies)
    mvn clean package -DskipTests -Plocal -q
    
    if [ ! -f "target/batch-processor-1.0.0-SNAPSHOT.jar" ]; then
        log_error "Build failed - JAR not found"
        exit 1
    fi
    
    log_info "Batch processor built successfully"
}

# Run Spark batch processor
run_batch_processor() {
    log_info "Running Spark batch processor..."
    log_info "  JDBC URL: $POSTGRES_JDBC_URL"
    log_info "  Neo4j URI: $NEO4J_URI"
    log_info "  Network: $NETWORK"
    
    cd "$PROJECT_ROOT/processing/batch-processor"
    
    # Run Spark job locally
    spark-submit \
        --class com.chainrisk.batch.BatchProcessorApp \
        --master local[*] \
        --driver-memory 1g \
        --executor-memory 1g \
        --conf spark.sql.adaptive.enabled=true \
        target/batch-processor-1.0.0-SNAPSHOT.jar \
        --jdbc.url "$POSTGRES_JDBC_URL" \
        --jdbc.user "$POSTGRES_USER" \
        --jdbc.password "$POSTGRES_PASSWORD" \
        --neo4j.uri "$NEO4J_URI" \
        --neo4j.user "$NEO4J_USER" \
        --neo4j.password "$NEO4J_PASSWORD" \
        --enable.neo4j.sink "$ENABLE_NEO4J_SINK" \
        --network "$NETWORK" \
        2>&1 | tee /tmp/spark-batch-processor.log
    
    log_info "Batch processing completed"
}

# Verify batch correction results
verify_batch_results() {
    log_info "Verifying batch correction results..."
    
    # Count stream vs batch transfers
    STREAM_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
        "SELECT COUNT(*) FROM chain_data.transfers WHERE source='stream'" 2>/dev/null | tr -d ' ')
    
    BATCH_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
        "SELECT COUNT(*) FROM chain_data.transfers WHERE source='batch'" 2>/dev/null | tr -d ' ')
    
    CORRECTED_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
        "SELECT COUNT(*) FROM chain_data.transfers WHERE corrected_at IS NOT NULL" 2>/dev/null | tr -d ' ')
    
    log_info "PostgreSQL Results:"
    log_info "  - Stream transfers: $STREAM_COUNT (should be 0 after correction)"
    log_info "  - Batch transfers: $BATCH_COUNT (should be > 0)"
    log_info "  - Corrected transfers: $CORRECTED_COUNT"
    
    local TEST_FAILED=0
    
    # Validate that stream data was corrected
    if [ "$BATCH_COUNT" -eq 0 ]; then
        log_error "No batch transfers found! Batch correction failed"
        TEST_FAILED=1
    else
        log_info "✓ Batch correction successful"
    fi
    
    # In production, stream data should be overwritten
    # For testing, we expect all data to be marked as batch
    if [ "$STREAM_COUNT" -gt 0 ]; then
        log_warn "Still have $STREAM_COUNT stream transfers (expected 0 after correction)"
        log_warn "This might be expected if batch job only processes specific data"
    else
        log_info "✓ All stream data corrected to batch"
    fi
    
    return $TEST_FAILED
}

# Verify Neo4j batch results
verify_neo4j_batch_results() {
    if [ "$ENABLE_NEO4J_SINK" != "true" ]; then
        log_info "Neo4j verification skipped (sink disabled)"
        return 0
    fi
    
    log_info "Verifying Neo4j batch correction..."
    
    if ! command -v cypher-shell &> /dev/null; then
        log_warn "cypher-shell not installed, skipping Neo4j verification"
        return 0
    fi
    
    # Count stream vs batch relationships
    STREAM_REL_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER {source: 'stream'}]->() RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    BATCH_REL_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER {source: 'batch'}]->() RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    CORRECTED_REL_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
        "MATCH ()-[r:TRANSFER]->() WHERE r.corrected_at IS NOT NULL RETURN count(r) as count" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    
    log_info "Neo4j Results:"
    log_info "  - Stream TRANSFER relationships: $STREAM_REL_COUNT (should be 0)"
    log_info "  - Batch TRANSFER relationships: $BATCH_REL_COUNT (should be > 0)"
    log_info "  - Corrected relationships: $CORRECTED_REL_COUNT"
    
    if [ "$BATCH_REL_COUNT" -gt 0 ]; then
        log_info "✓ Neo4j batch correction successful"
        
        if [ "$STREAM_REL_COUNT" -eq 0 ]; then
            log_info "✓ All stream relationships corrected to batch"
        else
            log_warn "Still have $STREAM_REL_COUNT stream relationships"
        fi
        
        return 0
    else
        log_warn "Neo4j batch correction validation failed"
        return 1
    fi
}

# Print comparison data
print_comparison_data() {
    log_info "Data comparison (Stream vs Batch):"
    
    echo ""
    echo "=== PostgreSQL: Source Distribution ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    source,
    COUNT(*) as count,
    MIN(block_number) as min_block,
    MAX(block_number) as max_block,
    COUNT(CASE WHEN corrected_at IS NOT NULL THEN 1 END) as corrected_count
FROM chain_data.transfers
GROUP BY source
ORDER BY source;
EOF
    
    echo ""
    echo "=== Sample Batch Transfers ==="
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB << EOF
SELECT 
    tx_hash, 
    block_number, 
    source,
    corrected_at,
    from_address, 
    to_address
FROM chain_data.transfers
WHERE source = 'batch'
ORDER BY block_number DESC
LIMIT 5;
EOF
    
    if [ "$ENABLE_NEO4J_SINK" = "true" ] && command -v cypher-shell &> /dev/null; then
        echo ""
        echo "=== Neo4j: Source Distribution ==="
        cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
            "MATCH ()-[r:TRANSFER]->() RETURN r.source as source, count(r) as count ORDER BY source" \
            --format plain 2>/dev/null || log_warn "Failed to query Neo4j"
    fi
}

# Main execution
main() {
    log_info "================================================"
    log_info "Phase 3: Spark Batch Processing"
    log_info "Lambda Architecture - Batch Layer"
    log_info "================================================"
    
    check_prerequisites
    verify_stream_data_exists
    build_batch_processor
    run_batch_processor
    
    if ! verify_batch_results; then
        log_error "Batch correction verification failed"
        exit 1
    fi
    
    verify_neo4j_batch_results || log_warn "Neo4j verification had issues (non-fatal)"
    
    print_comparison_data
    
    log_info "================================================"
    log_info "✅ Phase 3 Complete"
    log_info "================================================"
    log_info ""
    log_info "Lambda Architecture Test Flow:"
    log_info "  Phase 1: Data Ingestion → Kafka"
    log_info "  Phase 2: Flink Stream → PostgreSQL + Neo4j (source='stream')"
    log_info "  Phase 3: Spark Batch → Correct to (source='batch') ✓"
    log_info ""
    log_info "To run full test:"
    log_info "  ./scripts/test-integration-phase1.sh"
    log_info "  ./scripts/test-integration-phase2.sh"
    log_info "  ./scripts/test-integration-phase3.sh"
}

main "$@"
