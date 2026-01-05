#!/bin/bash
# ============================================================
# Run Label Ingestion Job
# ============================================================
# Fetches label data from public sources (OFAC, Tornado Cash, Exchanges)
# and writes to Hudi address_labels table
#
# Usage:
#   ./scripts/run-label-ingestion.sh
#   LABEL_SOURCES=ofac,tornado_cash ./scripts/run-label-ingestion.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/load-env.sh"

# Configuration
BATCH_JAR="$PROJECT_ROOT/processing/batch-processor/target/batch-processor-1.0.0-SNAPSHOT.jar"

# Check if JAR exists
if [ ! -f "$BATCH_JAR" ]; then
    log_error "JAR not found: $BATCH_JAR"
    log_info "Building batch-processor..."
    cd "$PROJECT_ROOT/processing/batch-processor"
    mvn package -DskipTests -Plocal
fi

# Environment variables
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://${DOCKER_HOST_IP:-localhost}:19000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
export HUDI_BASE_PATH="${HUDI_BASE_PATH:-s3a://chainrisk-datalake/hudi}"
export HIVE_METASTORE_URI="${HIVE_METASTORE_URI:-thrift://${DOCKER_HOST_IP:-localhost}:19083}"
export SPARK_MASTER="${SPARK_MASTER:-local[*]}"
export LABEL_SOURCES="${LABEL_SOURCES:-ofac,tornado_cash,exchange}"

log_info "=== Label Ingestion Job ==="
log_info "MinIO: $MINIO_ENDPOINT"
log_info "Hudi Path: $HUDI_BASE_PATH"
log_info "Hive Metastore: $HIVE_METASTORE_URI"
log_info "Label Sources: $LABEL_SOURCES"

# Run the job
log_info "Starting label ingestion..."

java -cp "$BATCH_JAR" \
    -Dlog4j.configuration=file:"$PROJECT_ROOT/processing/batch-processor/src/main/resources/log4j.properties" \
    com.chainrisk.batch.BatchProcessorApp labels

log_success "Label ingestion completed!"
