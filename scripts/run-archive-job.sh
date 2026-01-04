#!/bin/bash
# ============================================================
# Run Archive to Hudi Job
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"

if [ -z "$DOCKER_HOST_IP" ]; then
    source "$SCRIPT_DIR/load-env.sh"
fi

log_section "Archive to Hudi Job"

export MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://${DOCKER_HOST_IP}:19000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
export HUDI_BASE_PATH="${HUDI_BASE_PATH:-s3a://chainrisk-datalake/hudi}"
export RETENTION_DAYS="${RETENTION_DAYS:-7}"
export SPARK_MASTER="${SPARK_MASTER:-local[*]}"

log_info "PostgreSQL: ${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "MinIO: ${MINIO_ENDPOINT}"
log_info "Hudi Path: ${HUDI_BASE_PATH}"
log_info "Retention Days: ${RETENTION_DAYS}"

BATCH_JAR="$PROJECT_ROOT/processing/batch-processor/target/batch-processor-1.0.0-SNAPSHOT.jar"
if [ ! -f "$BATCH_JAR" ]; then
    log_info "Building batch-processor..."
    cd "$PROJECT_ROOT/processing/batch-processor"
    mvn clean package -DskipTests -Plocal -q
    cd "$PROJECT_ROOT"
fi

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

log_info "Starting archive job..."
java $JAVA_OPTS -cp "$BATCH_JAR" com.chainrisk.batch.job.ArchiveToHudiJob

log_success "Archive job completed"
