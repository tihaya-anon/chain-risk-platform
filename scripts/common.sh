#!/bin/bash
# ============================================================
# Common utilities for Chain Risk Platform scripts
# ============================================================
# Usage: source scripts/common.sh
# ============================================================

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Get project root directory
get_project_root() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "$(dirname "$script_dir")"
}

# Load environment variables from .env.local
load_env() {
    local project_root="${1:-$(get_project_root)}"
    local env_file="$project_root/.env.local"
    
    if [ ! -f "$env_file" ]; then
        log_error ".env.local not found at: $env_file"
        return 1
    fi
    
    # Export variables from .env.local
    set -a
    source "$env_file"
    set +a
    
    # Set defaults
    export DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
    export POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
    export POSTGRES_PORT="${POSTGRES_PORT:-15432}"
    export POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
    export POSTGRES_DB="${POSTGRES_DB:-chainrisk}"
    export REDIS_HOST="${REDIS_HOST:-$DOCKER_HOST_IP}"
    export REDIS_PORT="${REDIS_PORT:-16379}"
    export KAFKA_BROKERS="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
    export NEO4J_HOST="${NEO4J_HOST:-$DOCKER_HOST_IP}"
    export NEO4J_PORT="${NEO4J_PORT:-17687}"
    export NEO4J_URI="${NEO4J_URI:-bolt://$DOCKER_HOST_IP:17687}"
    export NEO4J_USER="${NEO4J_USER:-neo4j}"
    export NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"
    
    log_info "Environment loaded from: $env_file"
    log_info "Docker Host: $DOCKER_HOST_IP"
}

# Setup Java 17 environment
setup_java17() {
    if /usr/libexec/java_home -v 17 &>/dev/null; then
        export JAVA_HOME=$(/usr/libexec/java_home -v 17)
        log_info "Using Java 17: $JAVA_HOME"
        return 0
    else
        log_error "Java 17 not found. Please install Java 17."
        return 1
    fi
}

# Check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check if a service is running on a port
check_port() {
    local host="${1:-localhost}"
    local port="$2"
    nc -z "$host" "$port" 2>/dev/null
}

# Wait for a service to be ready
wait_for_service() {
    local name="$1"
    local url="$2"
    local max_attempts="${3:-30}"
    local sleep_time="${4:-1}"
    
    log_info "Waiting for $name to be ready..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -s "$url" > /dev/null 2>&1; then
            log_success "$name is ready"
            return 0
        fi
        sleep "$sleep_time"
    done
    
    log_error "$name failed to start within ${max_attempts}s"
    return 1
}

# Kill process by pattern
kill_by_pattern() {
    local pattern="$1"
    local signal="${2:--TERM}"
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        log_warn "No process found matching: $pattern"
        return 0
    fi
    
    log_info "Found process(es): $pids"
    
    for pid in $pids; do
        log_info "Stopping process $pid..."
        kill "$signal" "$pid" 2>/dev/null || true
    done
    
    # Wait for processes to stop
    sleep 2
    
    # Check if still running
    local remaining=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$remaining" ]; then
        log_warn "Force killing remaining processes: $remaining"
        for pid in $remaining; do
            kill -9 "$pid" 2>/dev/null || true
        done
    fi
    
    log_success "Process(es) stopped"
}

# Build Go service
build_go_service() {
    local service_dir="$1"
    local output_name="$2"
    local cmd_path="${3:-./cmd/...}"
    
    log_info "Building Go service: $output_name"
    
    cd "$service_dir"
    mkdir -p bin
    go build -o "bin/$output_name" "$cmd_path"
    
    log_success "Built: $service_dir/bin/$output_name"
}

# Build Java service with Maven
build_java_service() {
    local service_dir="$1"
    local skip_tests="${2:-true}"
    
    log_info "Building Java service: $service_dir"
    
    setup_java17 || return 1
    
    cd "$service_dir"
    
    if [ "$skip_tests" = "true" ]; then
        mvn clean package -DskipTests -q
    else
        mvn clean package -q
    fi
    
    log_success "Built: $service_dir"
}

# Export all functions
export -f log_info log_success log_warn log_error log_section
export -f get_project_root load_env setup_java17
export -f command_exists check_port wait_for_service
export -f kill_by_pattern build_go_service build_java_service
