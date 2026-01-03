#!/bin/bash
# ============================================================
# Flink Stream Processor startup script (Lambda Speed Layer)
# Supports dual-write to PostgreSQL + Neo4j
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

log_info "Starting Flink Stream Processor (Lambda Speed Layer)..."
log_info "Kafka Brokers: $KAFKA_BROKERS"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
log_info "Neo4j: ${NEO4J_URI:-bolt://localhost:17687}"
log_info "Neo4j Sink: ${ENABLE_NEO4J_SINK:-true}"
log_info "Kafka Producer: ${ENABLE_KAFKA_PRODUCER:-true}"

# Build Java arguments
JAVA_ARGS=(
    --add-opens java.base/java.util=ALL-UNNAMED
    --add-opens java.base/java.lang=ALL-UNNAMED
    --add-opens java.base/java.lang.reflect=ALL-UNNAMED
    -jar target/stream-processor-1.0.0-SNAPSHOT.jar
    --kafka.brokers "${KAFKA_BROKERS}"
    --jdbc.url "jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
)

# Add Neo4j configuration if provided
if [ -n "$NEO4J_URI" ]; then
    JAVA_ARGS+=(--neo4j.uri "$NEO4J_URI")
fi

if [ -n "$NEO4J_USER" ]; then
    JAVA_ARGS+=(--neo4j.user "$NEO4J_USER")
fi

if [ -n "$NEO4J_PASSWORD" ]; then
    JAVA_ARGS+=(--neo4j.password "$NEO4J_PASSWORD")
fi

# Add feature flags
if [ -n "$ENABLE_NEO4J_SINK" ]; then
    JAVA_ARGS+=(--enable.neo4j.sink "$ENABLE_NEO4J_SINK")
fi

if [ -n "$ENABLE_KAFKA_PRODUCER" ]; then
    JAVA_ARGS+=(--enable.kafka.producer "$ENABLE_KAFKA_PRODUCER")
fi

# Run Flink job
java "${JAVA_ARGS[@]}"
