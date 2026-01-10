#!/bin/bash
# ============================================================
# Flink Stream Processor startup script (Lambda Speed Layer)
# Writes to PostgreSQL, optional Kafka producer for downstream
# Uses tmux for easy process management
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"

load_env "$PROJECT_ROOT" || exit 1
setup_java17 || exit 1

TMUX_SESSION="flink-stream"

cd "$PROJECT_ROOT/processing/stream-processor"

log_info "Building Flink Stream Processor..."
mvn clean package -DskipTests -Plocal -q

log_info "Starting Flink Stream Processor (Lambda Speed Layer)..."
log_info "Kafka Source: $KAFKA_BROKERS / ${KAFKA_TOPIC:-chain-transactions}"
log_info "PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
log_info "Kafka Producer: ${ENABLE_KAFKA_PRODUCER:-false}"

# OTel Agent configuration
OTEL_AGENT="$PROJECT_ROOT/infra/otel/opentelemetry-javaagent.jar"
OTEL_CONFIG="$PROJECT_ROOT/infra/otel/otel-agent.properties"
OTEL_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}"

JAVA_OPTS=""
if [ "${OTEL_ENABLED:-false}" = "true" ] && [ -f "$OTEL_AGENT" ]; then
    log_info "OTel tracing enabled → Jaeger at $OTEL_ENDPOINT"
    JAVA_OPTS="-javaagent:$OTEL_AGENT -Dotel.javaagent.configuration-file=$OTEL_CONFIG -Dotel.service.name=stream-processor -Dotel.exporter.otlp.endpoint=$OTEL_ENDPOINT"
fi

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

# Kafka producer (disabled by default, enable for downstream consumers)
JAVA_ARGS+=(--kafka.transfers.brokers "${KAFKA_BROKERS}")
JAVA_ARGS+=(--kafka.transfers.topic "${KAFKA_TRANSFERS_TOPIC:-transfers}")
JAVA_ARGS+=(--enable.kafka.producer "${ENABLE_KAFKA_PRODUCER:-false}")

if [ -n "$ENABLE_STATE_TRACKING" ]; then
    JAVA_ARGS+=(--enable.state.tracking "$ENABLE_STATE_TRACKING")
fi

if command -v tmux &> /dev/null; then
    log_info "Tmux session: $TMUX_SESSION"
    
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    tmux new-session -d -s "$TMUX_SESSION" "java $JAVA_OPTS ${JAVA_ARGS[*]}"
    
    log_info "Flink started in tmux"
    log_info "  Attach: tmux attach -t $TMUX_SESSION"
    log_info "  Stop:   make flink-stop"
else
    log_warn "tmux not installed, running in foreground"
    java $JAVA_OPTS "${JAVA_ARGS[@]}"
fi
