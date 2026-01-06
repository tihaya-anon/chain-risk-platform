#!/bin/bash
# Integration Test - Phase 3: Batch Processing
# Reads from PostgreSQL, writes to Hudi + Neo4j

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"
source "$PROJECT_ROOT/scripts/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
NEO4J_HOST="${NEO4J_HOST:-$DOCKER_HOST_IP}"
NEO4J_BOLT_PORT="${NEO4J_BOLT_PORT:-17687}"
NEO4J_URI="${NEO4J_URI:-bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT}"

log_info "=== Phase 3: Batch Processing ==="
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT → Hudi + Neo4j"

# Check PostgreSQL has data
PG_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
    "SELECT COUNT(*) FROM chain_data.transfers" 2>/dev/null | tr -d ' ')
[ "$PG_COUNT" -eq 0 ] && { log_error "No data in PostgreSQL. Run Phase 2 first: make test-integration-phase2"; exit 1; }
log_info "PostgreSQL transfers: $PG_COUNT"

# Build batch processor if needed
if [ ! -f "$PROJECT_ROOT/processing/batch-processor/target/batch-processor-1.0.0-SNAPSHOT.jar" ]; then
    log_info "Building batch processor..."
    make batch-build 2>&1 | tail -3
fi

# Run batch job with fail-fast behavior
run_batch_job() {
    local job=$1
    local desc=$2
    
    log_info "[$job] $desc..."
    
    local output
    if ! output=$(make batch-$job 2>&1); then
        log_error "[$job] FAILED"
        echo "$output" | grep -E "(ERROR|Exception|failed)" | head -5
        exit 1
    fi
    
    if echo "$output" | grep -qE "(ERROR|Exception.*failed)"; then
        log_error "[$job] completed with errors"
        echo "$output" | grep -E "(ERROR|Exception)" | head -5
        exit 1
    fi
    
    log_info "[$job] ✓"
}

log_info ""
run_batch_job "archive" "[1/5] Archive: PostgreSQL → Hudi"
run_batch_job "features" "[2/5] Features: Compute address features"
run_batch_job "labels" "[3/5] Labels: Ingest label data"
run_batch_job "training" "[4/5] Training: Prepare training dataset"
run_batch_job "neo4j" "[5/5] Neo4j: Sync transfers to graph"

# Verify Hudi tables
log_info ""
log_info "=== Hudi Table Summary ==="
./scripts/trino-query.sh "
SELECT 'transfers' as tbl, COUNT(*) as cnt FROM hudi.chainrisk.transfers
UNION ALL SELECT 'address_features', COUNT(*) FROM hudi.chainrisk.address_features
UNION ALL SELECT 'address_labels', COUNT(*) FROM hudi.chainrisk.address_labels
UNION ALL SELECT 'training_dataset', COUNT(*) FROM hudi.chainrisk.training_dataset
" 2>/dev/null | grep -E "transfers|features|labels|training" || log_warn "Trino query failed"

# Verify Neo4j
if command -v cypher-shell &>/dev/null; then
    log_info ""
    log_info "=== Neo4j Summary ==="
    NODES=$(cypher-shell -a "$NEO4J_URI" -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-chainrisk123}" \
        "MATCH (n) RETURN count(n)" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "?")
    RELS=$(cypher-shell -a "$NEO4J_URI" -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-chainrisk123}" \
        "MATCH ()-[r]->() RETURN count(r)" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "?")
    log_info "Nodes: $NODES, Relationships: $RELS"
fi

log_info ""
log_info "✅ Phase 3 Complete"
