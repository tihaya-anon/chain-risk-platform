#!/bin/bash
# ============================================================
# Flink Stream Processor startup script (Lambda Speed Layer)
# Supports dual-write to PostgreSQL + Neo4j
# Uses tmux for easy process management
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

# Tmux session name
TMUX_SESSION="flink-stream"

cd "$PROJECT_ROOT/processing/stream-processor"

log_info "Building Flink Stream Processor..."
mvn clean package -DskipTests -Plocal -q

log_info "Starting Flink Stream Processor (Lambda Speed Layer)..."
log_info "Kafka Brokers: $KAFKA_BROKERS"
log_info "Kafka Transfers Topic: ${KAFKA_TRANSFERS_TOPIC:-transfers}"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
log_info "Neo4j: ${NEO4J_URI:-bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT}"
log_info "Neo4j Sink: ${ENABLE_NEO4J_SINK:-true}"
log_info "Kafka Producer: ${ENABLE_KAFKA_PRODUCER:-true}"

# Build Java arguments
JAVA_ARGS=(
    --add-opens java.base/java.util=ALL-UNNAMED
    --add-opens java.base/java.lang=ALL-UNNAMED
    --add-opens java.base/java.lang.reflect=ALL-UNNAMED
    -jar target/stream-processor-1.0.0-SNAPSHOT.jar
    --kafka.brokers "${KAFKA_BROKERS}"
    --kafka.topic "${KAFKA_TOPIC:-chain-transactions}"
    --kafka.group.id "${KAFKA_GROUP_ID:-stream-processor}"
    --jdbc.url "jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    --jdbc.user "${POSTGRES_USER:-chainrisk}"
    --jdbc.password "${POSTGRES_PASSWORD:-chainrisk123}"
)

# Add Kafka producer configuration (for transfers topic)
JAVA_ARGS+=(--kafka.transfers.brokers "${KAFKA_BROKERS}")
JAVA_ARGS+=(--kafka.transfers.topic "${KAFKA_TRANSFERS_TOPIC:-transfers}")

# Add Neo4j configuration if provided
if [ -n "$NEO4J_URI" ]; then
    JAVA_ARGS+=(--neo4j.uri "$NEO4J_URI")
elif [ -n "$NEO4J_HOST" ] && [ -n "$NEO4J_BOLT_PORT" ]; then
    JAVA_ARGS+=(--neo4j.uri "bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT")
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

if [ -n "$ENABLE_STATE_TRACKING" ]; then
    JAVA_ARGS+=(--enable.state.tracking "$ENABLE_STATE_TRACKING")
fi

# Check if tmux is available
if command -v tmux &> /dev/null; then
    log_info "Using tmux session: $TMUX_SESSION"
    log_info "To attach: tmux attach -t $TMUX_SESSION"
    log_info "To stop: tmux kill-session -t $TMUX_SESSION"
    
    # Kill existing session if exists
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    
    # Create new tmux session and run Flink
    tmux new-session -d -s "$TMUX_SESSION" "java ${JAVA_ARGS[*]}"
    
    log_info "Flink started in tmux session '$TMUX_SESSION'"
    log_info ""
    log_info "Commands:"
    log_info "  View logs:  tmux attach -t $TMUX_SESSION"
    log_info "  Stop Flink: tmux kill-session -t $TMUX_SESSION"
    log_info "  Or use:     make stop-flink"
    
else
    log_warn "tmux not installed, running Flink in foreground"
    log_warn "Press Ctrl+C to stop (may not work properly)"
    log_warn "Install tmux: brew install tmux (macOS) or apt-get install tmux (Linux)"
    
    # Run Flink job directly
    java "${JAVA_ARGS[@]}"
fi
