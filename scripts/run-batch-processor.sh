#!/bin/bash
# ============================================================
# Run Batch Processor - Unified Entry Point
# ============================================================
# Usage:
#   ./scripts/run-batch-processor.sh <job-name>
#
# Jobs:
#   archive   - Archive PostgreSQL cold data to Hudi
#   correct   - Batch correction on Hudi historical data
#   features  - Compute ML features from transfers
#   labels    - Ingest label data from public sources
#   training  - Prepare training dataset
#   neo4j     - Sync transfers to Neo4j graph database
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/processing/batch-processor"

source "$SCRIPT_DIR/common.sh"

if [ -z "$DOCKER_HOST_IP" ]; then
    source "$SCRIPT_DIR/load-env.sh"
fi

JOB_NAME="${1:-}"
if [ -z "$JOB_NAME" ]; then
    log_error "Usage: $0 <job-name>"
    log_info "Jobs: archive, correct, features, labels, training, neo4j"
    exit 1
fi

case "$JOB_NAME" in
    archive|correct|features|labels|training|neo4j) ;;
    *)
        log_error "Unknown job: $JOB_NAME"
        log_info "Jobs: archive, correct, features, labels, training, neo4j"
        exit 1
        ;;
esac

log_section "Batch Processor - $JOB_NAME"

# Common environment
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://${DOCKER_HOST_IP:-localhost}:19000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
export HUDI_BASE_PATH="${HUDI_BASE_PATH:-s3a://chainrisk-datalake/hudi}"
export HIVE_METASTORE_URI="${HIVE_METASTORE_URI:-thrift://${DOCKER_HOST_IP:-localhost}:19083}"
export SPARK_MASTER="${SPARK_MASTER:-local[*]}"

# Neo4j
export NEO4J_URI="${NEO4J_URI:-bolt://${DOCKER_HOST_IP:-localhost}:17687}"
export NEO4J_USER="${NEO4J_USER:-neo4j}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"

# Job-specific
export NETWORK="${NETWORK:-ethereum}"
export RETENTION_DAYS="${RETENTION_DAYS:-7}"
export LABEL_SOURCES="${LABEL_SOURCES:-ofac,tornado_cash,exchange}"
export FULL_SYNC="${FULL_SYNC:-true}"

# Build if needed
BATCH_JAR="$PROJECT_ROOT/target/batch-processor-1.0.0-SNAPSHOT.jar"
cd "$PROJECT_ROOT"
if [ ! -f "$BATCH_JAR" ]; then
    log_info "Building batch-processor..."
    mvn clean package -DskipTests -Plocal -q
fi

LOG4J2_CONFIG="$PROJECT_ROOT/src/main/resources/log4j2.properties"

# JVM options for Java 17+
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

# Log config based on job
case "$JOB_NAME" in
    archive)
        log_info "PostgreSQL: ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-15432}"
        log_info "MinIO: ${MINIO_ENDPOINT}"
        log_info "Retention: ${RETENTION_DAYS} days"
        ;;
    correct)
        log_info "MinIO: ${MINIO_ENDPOINT}"
        log_info "Hudi: ${HUDI_BASE_PATH}"
        ;;
    features|training)
        log_info "Hudi: ${HUDI_BASE_PATH}"
        log_info "Network: ${NETWORK}"
        ;;
    labels)
        log_info "Sources: ${LABEL_SOURCES}"
        ;;
    neo4j)
        log_info "Hudi: ${HUDI_BASE_PATH}"
        log_info "Neo4j: ${NEO4J_URI}"
        log_info "Network: ${NETWORK}"
        log_info "Full sync: ${FULL_SYNC}"
        ;;
esac

log_info "Starting $JOB_NAME job..."

java $JAVA_OPTS -cp "$BATCH_JAR" \
    -Dlog4j2.configurationFile="file://$LOG4J2_CONFIG" \
    -Dlog4j2.disableJmx=true \
    -Djob.name="$JOB_NAME" \
    com.chainrisk.batch.BatchProcessorApp "$JOB_NAME"

log_success "$JOB_NAME job completed!"
