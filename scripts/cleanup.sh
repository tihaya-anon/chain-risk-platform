#!/bin/bash
# Cleanup script - clear all test data from Kafka, PostgreSQL, Neo4j, Hudi

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
source "$SCRIPT_DIR/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="${POSTGRES_DB:-chainrisk}"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
NEO4J_URI="${NEO4J_URI:-bolt://$DOCKER_HOST_IP:17687}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://$DOCKER_HOST_IP:19000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
HUDI_BUCKET="${HUDI_BUCKET:-chainrisk-datalake}"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --all        Clean all (default)"
    echo "  --kafka      Clean Kafka topics only"
    echo "  --postgres   Clean PostgreSQL only"
    echo "  --neo4j      Clean Neo4j only"
    echo "  --hudi       Clean Hudi/MinIO only"
    echo "  --dry-run    Show what would be cleaned"
    echo "  -y, --yes    Skip confirmation"
    echo ""
    exit 0
}

CLEAN_KAFKA=false
CLEAN_POSTGRES=false
CLEAN_NEO4J=false
CLEAN_HUDI=false
DRY_RUN=false
SKIP_CONFIRM=false

# Parse args
if [ $# -eq 0 ]; then
    CLEAN_KAFKA=true; CLEAN_POSTGRES=true; CLEAN_NEO4J=true; CLEAN_HUDI=true
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --all) CLEAN_KAFKA=true; CLEAN_POSTGRES=true; CLEAN_NEO4J=true; CLEAN_HUDI=true; shift ;;
        --kafka) CLEAN_KAFKA=true; shift ;;
        --postgres) CLEAN_POSTGRES=true; shift ;;
        --neo4j) CLEAN_NEO4J=true; shift ;;
        --hudi) CLEAN_HUDI=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -y|--yes) SKIP_CONFIRM=true; shift ;;
        -h|--help) usage ;;
        *) log_error "Unknown option: $1"; usage ;;
    esac
done

log_info "=== Cleanup Script ==="
log_info "Targets: Kafka=$CLEAN_KAFKA PostgreSQL=$CLEAN_POSTGRES Neo4j=$CLEAN_NEO4J Hudi=$CLEAN_HUDI"
[ "$DRY_RUN" = true ] && log_warn "DRY RUN - no changes will be made"

if [ "$SKIP_CONFIRM" != true ] && [ "$DRY_RUN" != true ]; then
    echo ""
    read -p "This will DELETE all data. Continue? [y/N] " -n 1 -r
    echo ""
    [[ ! $REPLY =~ ^[Yy]$ ]] && { log_info "Aborted"; exit 0; }
fi

# Kafka cleanup
clean_kafka() {
    log_info "Cleaning Kafka..."
    
    if ! nc -z ${KAFKA_BROKER%:*} ${KAFKA_BROKER#*:} 2>/dev/null; then
        log_warn "Kafka not reachable at $KAFKA_BROKER"
        return 1
    fi
    
    TOPICS=("chain-transactions" "transfers")
    
    for topic in "${TOPICS[@]}"; do
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY-RUN] Would delete topic: $topic"
        else
            if command -v kcat &>/dev/null; then
                # Check if topic exists
                if kcat -b $KAFKA_BROKER -L 2>/dev/null | grep -q "$topic"; then
                    log_info "Deleting topic: $topic"
                    # Use kafka-topics.sh if available, otherwise just log
                    if command -v kafka-topics &>/dev/null; then
                        kafka-topics --bootstrap-server $KAFKA_BROKER --delete --topic $topic 2>/dev/null || true
                    else
                        log_warn "kafka-topics not available. Topic $topic exists but cannot be deleted automatically."
                        log_warn "Run: kafka-topics --bootstrap-server $KAFKA_BROKER --delete --topic $topic"
                    fi
                fi
            else
                log_warn "kcat not installed, cannot verify Kafka topics"
            fi
        fi
    done
    
    log_info "Kafka cleanup done"
}

# PostgreSQL cleanup
clean_postgres() {
    log_info "Cleaning PostgreSQL..."
    
    if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1" >/dev/null 2>&1; then
        log_warn "PostgreSQL not reachable at $POSTGRES_HOST:$POSTGRES_PORT"
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would truncate: chain_data.transfers, chain_data.transactions, chain_data.processing_state"
        PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c \
            "SELECT 'transfers' as table_name, COUNT(*) FROM chain_data.transfers UNION ALL SELECT 'transactions', COUNT(*) FROM chain_data.transactions UNION ALL SELECT 'processing_state', COUNT(*) FROM chain_data.processing_state"
    else
        log_info "Truncating tables..."
        PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
TRUNCATE chain_data.transfers CASCADE;
TRUNCATE chain_data.transactions CASCADE;
TRUNCATE chain_data.processing_state CASCADE;
EOF
        log_info "PostgreSQL cleanup done"
    fi
}

# Neo4j cleanup
clean_neo4j() {
    log_info "Cleaning Neo4j..."
    
    NEO4J_HOST_ONLY="${NEO4J_URI#bolt://}"
    NEO4J_HOST_ONLY="${NEO4J_HOST_ONLY%:*}"
    NEO4J_PORT="${NEO4J_URI##*:}"
    
    if ! nc -z $NEO4J_HOST_ONLY $NEO4J_PORT 2>/dev/null; then
        log_warn "Neo4j not reachable at $NEO4J_URI"
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would delete all nodes and relationships"
        if command -v cypher-shell &>/dev/null; then
            cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
                "MATCH (n) RETURN count(n) as nodes" --format plain 2>/dev/null || true
        fi
    else
        if command -v cypher-shell &>/dev/null; then
            log_info "Deleting all nodes and relationships..."
            cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
                "MATCH (n) DETACH DELETE n" --format plain 2>/dev/null || log_warn "Failed to clean Neo4j"
            log_info "Neo4j cleanup done"
        else
            # Try using HTTP API with curl
            log_info "cypher-shell not found, trying HTTP API..."
            NEO4J_HTTP="http://${NEO4J_HOST_ONLY}:17474"
            QUERY='{"statements":[{"statement":"MATCH (n) DETACH DELETE n"}]}'
            
            HTTP_RESULT=$(curl -s -X POST "$NEO4J_HTTP/db/neo4j/tx/commit" \
                -H "Content-Type: application/json" \
                -u "$NEO4J_USER:$NEO4J_PASSWORD" \
                -d "$QUERY" 2>/dev/null)
            
            if echo "$HTTP_RESULT" | grep -q '"errors":\[\]'; then
                log_info "Neo4j cleanup done (via HTTP)"
            else
                log_warn "Neo4j cleanup may have failed. Install cypher-shell for better support."
                log_warn "  brew install cypher-shell (macOS)"
            fi
        fi
    fi
}

# Hudi/MinIO cleanup
clean_hudi() {
    log_info "Cleaning Hudi (MinIO)..."
    
    if ! command -v mc &>/dev/null; then
        log_warn "MinIO client (mc) not installed"
        log_warn "Install with: brew install minio/stable/mc"
        log_warn "Or manually delete via MinIO console: $MINIO_ENDPOINT"
        return 1
    fi
    
    # Configure mc alias
    mc alias set cleanup-minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1 || {
        log_warn "Failed to configure MinIO client"
        return 1
    }
    
    HUDI_TABLES=("transfers" "address_features" "address_labels" "training_dataset")
    
    for table in "${HUDI_TABLES[@]}"; do
        PATH_TO_DELETE="cleanup-minio/$HUDI_BUCKET/hudi/$table"
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY-RUN] Would delete: $PATH_TO_DELETE"
            mc ls "$PATH_TO_DELETE" 2>/dev/null | head -5 || true
        else
            if mc ls "$PATH_TO_DELETE" >/dev/null 2>&1; then
                log_info "Deleting: hudi/$table"
                mc rm -r --force "$PATH_TO_DELETE" 2>/dev/null || true
            fi
        fi
    done
    
    # Remove alias
    mc alias rm cleanup-minio >/dev/null 2>&1 || true
    
    log_info "Hudi cleanup done"
}

# Execute cleanup
[ "$CLEAN_KAFKA" = true ] && clean_kafka
[ "$CLEAN_POSTGRES" = true ] && clean_postgres
[ "$CLEAN_NEO4J" = true ] && clean_neo4j
[ "$CLEAN_HUDI" = true ] && clean_hudi

log_info "✅ Cleanup complete"
