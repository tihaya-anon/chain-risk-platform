#!/bin/bash
# ============================================================
# Run Batch Processor - Unified Entry Point
# ============================================================
# Usage:
#   ./scripts/run-batch-processor.sh <job-name> [options]
#
# Available jobs:
#   archive   - Archive PostgreSQL cold data to Hudi
#   correct   - Run batch correction on Hudi historical data
#   features  - Compute ML features from transfers
#   labels    - Ingest label data from public sources
#   training  - Prepare training dataset (join features + labels)
#
# Examples:
#   ./scripts/run-batch-processor.sh features
#   NETWORK=ethereum ./scripts/run-batch-processor.sh training
#   RETENTION_DAYS=30 ./scripts/run-batch-processor.sh archive
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/processing/batch-processor"

source "$SCRIPT_DIR/common.sh"

if [ -z "$DOCKER_HOST_IP" ]; then
    source "$SCRIPT_DIR/load-env.sh"
fi

# Check job argument
JOB_NAME="${1:-}"
if [ -z "$JOB_NAME" ]; then
    log_error "Usage: $0 <job-name>"
    log_info "Available jobs: archive, correct, features, labels, training"
    exit 1
fi

# Validate job name
case "$JOB_NAME" in
    archive|correct|features|labels|training) ;;
    *)
        log_error "Unknown job: $JOB_NAME"
        log_info "Available jobs: archive, correct, features, labels, training"
        exit 1
        ;;
esac

log_section "Batch Processor - $JOB_NAME"

# Common environment variables
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://${DOCKER_HOST_IP:-localhost}:19000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
export HUDI_BASE_PATH="${HUDI_BASE_PATH:-s3a://chainrisk-datalake/hudi}"
export HIVE_METASTORE_URI="${HIVE_METASTORE_URI:-thrift://${DOCKER_HOST_IP:-localhost}:19083}"
export SPARK_MASTER="${SPARK_MASTER:-local[*]}"

# Job-specific defaults
export NETWORK="${NETWORK:-ethereum}"
export RETENTION_DAYS="${RETENTION_DAYS:-7}"
export LABEL_SOURCES="${LABEL_SOURCES:-ofac,tornado_cash,exchange}"

# Build if needed
BATCH_JAR="$PROJECT_ROOT/target/batch-processor-1.0.0-SNAPSHOT.jar"
cd "$PROJECT_ROOT"
if [ ! -f "$BATCH_JAR" ]; then
    log_info "Building batch-processor..."
    mvn clean package -DskipTests -Plocal -q
fi

# Log4j2 configuration
LOG4J2_CONFIG="$PROJECT_ROOT/src/main/resources/log4j2.properties"

# JVM options for Java 17+ compatibility with Spark
JAVA_OPTS="--add-opens=java.base/java.lang=ALL-UNNAMED \
--add-opens=java.base/java.lang.invoke=ALL-UNNAMED \
--add-opens=java.base/java.lang.reflect=ALL-UNNAMED \
--add-opens=java.base/java.io=ALL-UNNAMED \
--add-opens=java.base/java.net=ALL-UNNAMED \
--add-opens=java.base/java.nio=ALL-UNNAMED \
--add-opens=java.base/java.util=ALL-UNNAMED \
--add-opens=java.base/java.util.concurrent=ALL-UNNAMED \
--add-opens=java.base/java.util.concurrent.atomic=ALL-UNNAMED \
--add-opens=java.base/sun.nio.ch=ALL-UNNAMED \
--add-opens=java.base/sun.nio.cs=ALL-UNNAMED \
--add-opens=java.base/sun.security.action=ALL-UNNAMED \
--add-opens=java.base/sun.util.calendar=ALL-UNNAMED \
--add-opens=java.security.jgss/sun.security.krb5=ALL-UNNAMED"

# Log configuration based on job
case "$JOB_NAME" in
    archive)
        log_info "PostgreSQL: ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-15432}"
        log_info "MinIO: ${MINIO_ENDPOINT}"
        log_info "Hudi Path: ${HUDI_BASE_PATH}"
        log_info "Retention Days: ${RETENTION_DAYS}"
        ;;
    correct)
        log_info "MinIO: ${MINIO_ENDPOINT}"
        log_info "Hudi Path: ${HUDI_BASE_PATH}"
        log_info "Hive Metastore: ${HIVE_METASTORE_URI}"
        [ -n "$START_DATE" ] && log_info "Start Date: ${START_DATE}"
        [ -n "$END_DATE" ] && log_info "End Date: ${END_DATE}"
        ;;
    features|training)
        log_info "MinIO: ${MINIO_ENDPOINT}"
        log_info "Hudi Path: ${HUDI_BASE_PATH}"
        log_info "Hive Metastore: ${HIVE_METASTORE_URI}"
        log_info "Network: ${NETWORK}"
        ;;
    labels)
        log_info "MinIO: ${MINIO_ENDPOINT}"
        log_info "Hudi Path: ${HUDI_BASE_PATH}"
        log_info "Hive Metastore: ${HIVE_METASTORE_URI}"
        log_info "Label Sources: ${LABEL_SOURCES}"
        ;;
esac

# Run the job
log_info "Starting $JOB_NAME job..."

java $JAVA_OPTS -cp "$BATCH_JAR" \
    -Dlog4j2.configurationFile="file://$LOG4J2_CONFIG" \
    -Dlog4j2.disableJmx=true \
    -Djob.name="$JOB_NAME" \
    com.chainrisk.batch.BatchProcessorApp "$JOB_NAME"

log_success "$JOB_NAME job completed!"
