#!/bin/bash
# ============================================================
# Flink Stream Processor startup script
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common utilities
source "$SCRIPT_DIR/common.sh"

# Load environment
load_env "$PROJECT_ROOT" || exit 1

# Setup Java 17
setup_java17 || exit 1

cd "$PROJECT_ROOT/processing/stream-processor"

log_info "Building Flink Stream Processor..."
mvn clean package -DskipTests -Plocal -q

log_info "Starting Flink Stream Processor..."
log_info "Kafka Brokers: $KAFKA_BROKERS"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

java \
    --add-opens java.base/java.util=ALL-UNNAMED \
    --add-opens java.base/java.lang=ALL-UNNAMED \
    --add-opens java.base/java.lang.reflect=ALL-UNNAMED \
    -jar target/stream-processor-1.0.0-SNAPSHOT.jar \
    --kafka.brokers "${KAFKA_BROKERS}" \
    --jdbc.url "jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
