#!/bin/bash
# ============================================================
# Run Feature Compute Job
# ============================================================
# Computes ML features from transfers and writes to address_features table
#
# Usage:
#   ./scripts/run-feature-compute.sh
#   NETWORK=ethereum ./scripts/run-feature-compute.sh
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
export NETWORK="${NETWORK:-ethereum}"

log_info "=== Feature Compute Job ==="
log_info "MinIO: $MINIO_ENDPOINT"
log_info "Hudi Path: $HUDI_BASE_PATH"
log_info "Hive Metastore: $HIVE_METASTORE_URI"
log_info "Network: $NETWORK"

# Run the job
log_info "Starting feature computation..."

java -cp "$BATCH_JAR" \
    -Dlog4j.configuration=file:"$PROJECT_ROOT/processing/batch-processor/src/main/resources/log4j.properties" \
    com.chainrisk.batch.BatchProcessorApp features

log_success "Feature computation completed!"
