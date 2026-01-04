#!/bin/bash
# ============================================================
# Run Archive to Hudi Job
# ============================================================
# Usage:
#   source scripts/load-env.sh
#   ./scripts/run-archive-job.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"

# Load environment if not already loaded
if [ -z "$DOCKER_HOST_IP" ]; then
    source "$SCRIPT_DIR/load-env.sh"
fi

log_section "Archive to Hudi Job"

# Set Hudi-specific environment variables
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://${DOCKER_HOST_IP}:19000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
export HUDI_BASE_PATH="${HUDI_BASE_PATH:-s3a://chainrisk-datalake/hudi}"
export RETENTION_DAYS="${RETENTION_DAYS:-7}"

log_info "PostgreSQL: ${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "MinIO: ${MINIO_ENDPOINT}"
log_info "Hudi Path: ${HUDI_BASE_PATH}"
log_info "Retention Days: ${RETENTION_DAYS}"

# Build if needed
BATCH_JAR="$PROJECT_ROOT/processing/batch-processor/target/batch-processor-1.0.0-SNAPSHOT.jar"
if [ ! -f "$BATCH_JAR" ]; then
    log_info "Building batch-processor..."
    cd "$PROJECT_ROOT/processing/batch-processor"
    mvn clean package -DskipTests -Plocal -q
    cd "$PROJECT_ROOT"
fi

# Run the job
log_info "Starting archive job..."
java -cp "$BATCH_JAR" \
    -Dlog4j.configuration=file:"$PROJECT_ROOT/processing/batch-processor/src/main/resources/log4j2.properties" \
    com.chainrisk.batch.job.ArchiveToHudiJob

log_success "Archive job completed"
