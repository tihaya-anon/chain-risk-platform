#!/bin/bash
# ============================================================
# Graph Engine startup script
# Usage: ./run-graph-engine.sh [--build]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common utilities
source "$SCRIPT_DIR/common.sh"

GRAPH_ENGINE_DIR="$PROJECT_ROOT/processing/graph-engine"

# Load environment
load_env "$PROJECT_ROOT" || exit 1

# Setup Java 17
setup_java17 || exit 1

log_info "Configuration:"
echo "  DOCKER_HOST_IP: $DOCKER_HOST_IP"
echo "  POSTGRES: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "  NEO4J: $NEO4J_HOST:$NEO4J_PORT"

# Check Maven
if ! command_exists mvn; then
    log_error "Maven is not installed. Please install Maven first."
    exit 1
fi

cd "$GRAPH_ENGINE_DIR"

# Build if needed
if [ ! -f "target/graph-engine-1.0.0-SNAPSHOT.jar" ] || [ "$1" = "--build" ]; then
    build_java_service "$GRAPH_ENGINE_DIR" true || exit 1
fi

# Check connectivity
log_info "Checking PostgreSQL connectivity..."
if ! check_port "$POSTGRES_HOST" "$POSTGRES_PORT"; then
    log_warn "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
    log_warn "Make sure remote Docker services are running"
fi

log_info "Checking Neo4j connectivity..."
if ! check_port "$NEO4J_HOST" "$NEO4J_PORT"; then
    log_warn "Cannot connect to Neo4j at $NEO4J_HOST:$NEO4J_PORT"
    log_warn "Make sure remote Docker services are running"
fi

# Create logs directory
mkdir -p "$GRAPH_ENGINE_DIR/logs"

# Start the application
log_info "Starting Graph Engine on port 8084..."
log_info "Swagger UI: http://localhost:8084/swagger-ui.html"
log_info "API Docs: http://localhost:8084/api-docs"
log_info "Health: http://localhost:8084/api/health"

java -jar target/graph-engine-1.0.0-SNAPSHOT.jar \
    --spring.datasource.url="jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}" \
    --spring.datasource.username="${POSTGRES_USER}" \
    --spring.datasource.password="${POSTGRES_PASSWORD}" \
    --spring.neo4j.uri="bolt://${NEO4J_HOST}:${NEO4J_PORT}" \
    --spring.neo4j.authentication.username="${NEO4J_USER}" \
    --spring.neo4j.authentication.password="${NEO4J_PASSWORD}"
