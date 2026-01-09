#!/bin/bash
# ============================================================
# Rolling Data Cleanup Cron Script
# ============================================================
# Purpose: Clean up old data from PostgreSQL and Neo4j
# Schedule: Daily at 00:05 via cron
# 
# Crontab entry:
# 5 0 * * * /path/to/scripts/cleanup-cron.sh >> /var/log/chain-risk/cleanup.log 2>&1
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Load environment
load_env "$PROJECT_ROOT"

# ============================================
# Configuration
# ============================================

# Retention periods (days)
TRANSFERS_RETENTION_DAYS="${TRANSFERS_RETENTION_DAYS:-30}"
TRANSACTIONS_RETENTION_DAYS="${TRANSACTIONS_RETENTION_DAYS:-30}"
ALERTS_RETENTION_DAYS="${ALERTS_RETENTION_DAYS:-90}"
NEO4J_RETENTION_DAYS="${NEO4J_RETENTION_DAYS:-30}"

# Future partitions to create
PARTITION_DAYS_AHEAD="${PARTITION_DAYS_AHEAD:-7}"

# Database connection
PG_CONN="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
NEO4J_URI="${NEO4J_URI:-bolt://${NEO4J_HOST}:${NEO4J_PORT}}"

# ============================================
# Functions
# ============================================

cleanup_postgres() {
    log_section "PostgreSQL Cleanup"
    
    log_info "Retention: transfers=${TRANSFERS_RETENTION_DAYS}d, transactions=${TRANSACTIONS_RETENTION_DAYS}d, alerts=${ALERTS_RETENTION_DAYS}d"
    
    # Check if cleanup function exists
    local func_exists
    func_exists=$(psql "$PG_CONN" -t -c "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'rolling_cleanup_with_log');" 2>/dev/null | tr -d ' ')
    
    if [ "$func_exists" != "t" ]; then
        log_warn "Cleanup function not found. Running partition setup first..."
        psql "$PG_CONN" -f "$SCRIPT_DIR/db/pg-partition-setup.sql"
        psql "$PG_CONN" -f "$SCRIPT_DIR/db/pg-cleanup.sql"
    fi
    
    # Run cleanup
    log_info "Running PostgreSQL cleanup..."
    psql "$PG_CONN" -c "SELECT chain_data.rolling_cleanup_with_log($TRANSFERS_RETENTION_DAYS, $TRANSACTIONS_RETENTION_DAYS, $ALERTS_RETENTION_DAYS, $PARTITION_DAYS_AHEAD);"
    
    # Show partition stats
    log_info "Partition statistics:"
    psql "$PG_CONN" -c "SELECT * FROM chain_data.get_partition_stats();"
    
    # Show cleanup history
    log_info "Recent cleanup history:"
    psql "$PG_CONN" -c "SELECT * FROM chain_data.cleanup_log ORDER BY executed_at DESC LIMIT 5;"
    
    log_success "PostgreSQL cleanup complete"
}

cleanup_neo4j() {
    log_section "Neo4j Cleanup"
    
    log_info "Retention: ${NEO4J_RETENTION_DAYS} days"
    
    # Check if cypher-shell is available
    if ! command_exists cypher-shell; then
        log_warn "cypher-shell not found. Trying docker exec..."
        
        # Run via docker
        local neo4j_container="${NEO4J_CONTAINER:-neo4j}"
        
        if ! docker ps --format '{{.Names}}' | grep -q "^${neo4j_container}$"; then
            log_error "Neo4j container not running. Skipping Neo4j cleanup."
            return 1
        fi
        
        log_info "Running Neo4j cleanup via Docker..."
        
        # Create cleanup query
        local cleanup_query="
        // Delete old transfers
        CALL apoc.periodic.iterate(
            'MATCH ()-[r:TRANSFER]->() WHERE r.timestamp < datetime() - duration({days: ${NEO4J_RETENTION_DAYS}}) RETURN r',
            'DELETE r',
            {batchSize: 10000, parallel: false}
        ) YIELD batches, total, timeTaken
        RETURN 'transfers' AS type, batches, total, timeTaken;
        "
        
        docker exec "$neo4j_container" cypher-shell \
            -u "$NEO4J_USER" \
            -p "$NEO4J_PASSWORD" \
            "$cleanup_query"
        
        # Delete orphan addresses
        local orphan_query="
        CALL apoc.periodic.iterate(
            'MATCH (a:Address) WHERE NOT (a)-[:TRANSFER]-() AND NOT ()-[:TRANSFER]->(a) AND a.lastSeen < datetime() - duration({days: ${NEO4J_RETENTION_DAYS}}) AND (a.tags IS NULL OR size(a.tags) = 0) RETURN a',
            'DELETE a',
            {batchSize: 5000, parallel: false}
        ) YIELD batches, total, timeTaken
        RETURN 'orphan_addresses' AS type, batches, total, timeTaken;
        "
        
        docker exec "$neo4j_container" cypher-shell \
            -u "$NEO4J_USER" \
            -p "$NEO4J_PASSWORD" \
            "$orphan_query"
    else
        # Run directly with cypher-shell
        log_info "Running Neo4j cleanup..."
        
        cypher-shell \
            -a "$NEO4J_URI" \
            -u "$NEO4J_USER" \
            -p "$NEO4J_PASSWORD" \
            --param "retentionDays => ${NEO4J_RETENTION_DAYS}" \
            -f "$SCRIPT_DIR/db/neo4j-cleanup.cypher"
    fi
    
    log_success "Neo4j cleanup complete"
}

show_disk_usage() {
    log_section "Disk Usage"
    
    # PostgreSQL database size
    log_info "PostgreSQL database size:"
    psql "$PG_CONN" -c "
        SELECT 
            pg_size_pretty(pg_database_size('$POSTGRES_DB')) AS database_size,
            pg_size_pretty(pg_total_relation_size('chain_data.transfers_partitioned')) AS transfers_size,
            pg_size_pretty(pg_total_relation_size('chain_data.transactions_partitioned')) AS transactions_size
    ;" 2>/dev/null || log_warn "Could not get PostgreSQL disk usage"
    
    # Docker volumes
    log_info "Docker volume sizes:"
    docker system df -v 2>/dev/null | grep -E "(postgres|neo4j)" || true
}

# ============================================
# Main
# ============================================

main() {
    local start_time=$(date +%s)
    
    log_section "Rolling Data Cleanup - $(date '+%Y-%m-%d %H:%M:%S')"
    
    log_info "Configuration:"
    log_info "  PostgreSQL: ${POSTGRES_HOST}:${POSTGRES_PORT}"
    log_info "  Neo4j: ${NEO4J_HOST}:${NEO4J_PORT}"
    log_info "  Retention - Transfers: ${TRANSFERS_RETENTION_DAYS}d"
    log_info "  Retention - Transactions: ${TRANSACTIONS_RETENTION_DAYS}d"
    log_info "  Retention - Alerts: ${ALERTS_RETENTION_DAYS}d"
    log_info "  Retention - Neo4j: ${NEO4J_RETENTION_DAYS}d"
    
    # PostgreSQL cleanup
    cleanup_postgres || log_error "PostgreSQL cleanup failed"
    
    # Neo4j cleanup
    cleanup_neo4j || log_error "Neo4j cleanup failed"
    
    # Show disk usage
    show_disk_usage
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_section "Cleanup Complete"
    log_success "Total duration: ${duration}s"
}

# ============================================
# Entry Point
# ============================================

# Parse arguments
case "${1:-}" in
    --postgres-only)
        load_env "$PROJECT_ROOT"
        cleanup_postgres
        ;;
    --neo4j-only)
        load_env "$PROJECT_ROOT"
        cleanup_neo4j
        ;;
    --disk-usage)
        load_env "$PROJECT_ROOT"
        show_disk_usage
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --postgres-only  Run PostgreSQL cleanup only"
        echo "  --neo4j-only     Run Neo4j cleanup only"
        echo "  --disk-usage     Show disk usage only"
        echo "  --help           Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  TRANSFERS_RETENTION_DAYS     Default: 30"
        echo "  TRANSACTIONS_RETENTION_DAYS  Default: 30"
        echo "  ALERTS_RETENTION_DAYS        Default: 90"
        echo "  NEO4J_RETENTION_DAYS         Default: 30"
        echo "  PARTITION_DAYS_AHEAD         Default: 7"
        exit 0
        ;;
    *)
        main
        ;;
esac
