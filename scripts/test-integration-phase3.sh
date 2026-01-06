#!/bin/bash
# Integration Test - Phase 3: Batch Processing (Archive + Features + Labels + Training + Neo4j)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
source "$SCRIPT_DIR/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
NEO4J_URI="${NEO4J_URI:-bolt://$DOCKER_HOST_IP:17687}"
NETWORK="${NETWORK:-ethereum}"

log_info "=== Phase 3: Batch Processing ==="
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
log_info "Neo4j: $NEO4J_URI"
log_info "Hudi: ${HUDI_BASE_PATH:-s3a://chainrisk-datalake/hudi}"

# Check PostgreSQL has stream data
STREAM_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c \
    "SELECT COUNT(*) FROM chain_data.transfers" 2>/dev/null | tr -d ' ')
[ "$STREAM_COUNT" -eq 0 ] && { log_error "No stream data. Run Phase 2 first."; exit 1; }
log_info "Found $STREAM_COUNT transfers in PostgreSQL"

# Build batch processor
log_info "Building batch processor..."
make batch-build 2>&1 | tail -3

# Run batch jobs
log_info "Running batch jobs..."

log_info "[1/5] Archive job (PostgreSQL → Hudi)..."
make batch-archive 2>&1 | grep -E "(INFO|WARN|ERROR|✓)" | tail -10

log_info "[2/5] Feature compute job..."
make batch-features 2>&1 | grep -E "(INFO|WARN|ERROR|✓)" | tail -10

log_info "[3/5] Label ingestion job..."
make batch-labels 2>&1 | grep -E "(INFO|WARN|ERROR|✓)" | tail -10

log_info "[4/5] Training data preparation job..."
make batch-training 2>&1 | grep -E "(INFO|WARN|ERROR|✓)" | tail -10

log_info "[5/5] Neo4j sync job..."
make batch-neo4j 2>&1 | grep -E "(INFO|WARN|ERROR|✓)" | tail -10

# Verify Hudi tables
log_info "Verifying Hudi tables..."
./scripts/trino-query.sh "SELECT 'transfers' as tbl, COUNT(*) as cnt FROM hudi.datalake.transfers UNION ALL SELECT 'address_features', COUNT(*) FROM hudi.datalake.address_features UNION ALL SELECT 'address_labels', COUNT(*) FROM hudi.datalake.address_labels UNION ALL SELECT 'training_dataset', COUNT(*) FROM hudi.datalake.training_dataset" 2>/dev/null | tail -10

# Verify Neo4j
if command -v cypher-shell &>/dev/null; then
    log_info "Verifying Neo4j..."
    NEO4J_COUNT=$(cypher-shell -a "$NEO4J_URI" -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-chainrisk123}" \
        "MATCH ()-[r:TRANSFER]->() RETURN count(r)" --format plain 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    log_info "Neo4j TRANSFER relationships: $NEO4J_COUNT"
fi

log_info "✅ Phase 3 Complete"
log_info ""
log_info "Lambda Architecture Test Summary:"
log_info "  Phase 1: Data Ingestion → Kafka"
log_info "  Phase 2: Flink Stream → PostgreSQL"
log_info "  Phase 3: Spark Batch → Hudi + Neo4j ✓"
