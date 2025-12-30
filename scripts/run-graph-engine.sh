#!/bin/bash

# Graph Engine startup script
# Usage: ./run-graph-engine.sh [--build]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GRAPH_ENGINE_DIR="$PROJECT_ROOT/processing/graph-engine"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Set JAVA_HOME to Java 17 (required for Lombok compatibility)
if /usr/libexec/java_home -v 17 &>/dev/null; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 17)
    log_info "Using Java 17: $JAVA_HOME"
else
    log_error "Java 17 not found. Please install Java 17."
    exit 1
fi

# Load environment variables from .env.local
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    log_info "Loading environment from .env.local"
    set -a
    source "$PROJECT_ROOT/.env.local"
    set +a
else
    log_error ".env.local not found. Please create it with DOCKER_HOST_IP"
    exit 1
fi

# Validate DOCKER_HOST_IP
if [ -z "$DOCKER_HOST_IP" ]; then
    log_error "DOCKER_HOST_IP not set in .env.local"
    exit 1
fi

# Remote Docker host settings
export POSTGRES_HOST="$DOCKER_HOST_IP"
export POSTGRES_PORT="${POSTGRES_PORT:-15432}"
export POSTGRES_DB="${POSTGRES_DB:-chainrisk}"
export POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"

export NEO4J_HOST="$DOCKER_HOST_IP"
export NEO4J_PORT="${NEO4J_BOLT_PORT:-17687}"
export NEO4J_USERNAME="${NEO4J_USERNAME:-neo4j}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"

log_info "Configuration:"
echo "  DOCKER_HOST_IP: $DOCKER_HOST_IP"
echo "  POSTGRES: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "  NEO4J: $NEO4J_HOST:$NEO4J_PORT"

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    log_error "Maven is not installed. Please install Maven first."
    exit 1
fi

cd "$GRAPH_ENGINE_DIR"

# Build if needed
if [ ! -f "target/graph-engine-1.0.0-SNAPSHOT.jar" ] || [ "$1" = "--build" ]; then
    log_info "Building graph-engine..."
    mvn clean package -DskipTests -q
    if [ $? -ne 0 ]; then
        log_error "Build failed"
        exit 1
    fi
    log_info "Build completed"
fi

# Check connectivity
log_info "Checking PostgreSQL connectivity..."
if ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" 2>/dev/null; then
    log_warn "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
    log_warn "Make sure remote Docker services are running"
fi

log_info "Checking Neo4j connectivity..."
if ! nc -z "$NEO4J_HOST" "$NEO4J_PORT" 2>/dev/null; then
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
    --spring.neo4j.authentication.username="${NEO4J_USERNAME}" \
    --spring.neo4j.authentication.password="${NEO4J_PASSWORD}"
