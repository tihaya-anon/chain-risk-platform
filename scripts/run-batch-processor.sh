#!/bin/bash
# ============================================================
# Spark Batch Processor startup script (Lambda Batch Layer)
# Corrects stream data with batch processing
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
TMUX_SESSION="spark-batch"

# Configuration
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"

POSTGRES_HOST="${POSTGRES_HOST:-$DOCKER_HOST_IP}"
POSTGRES_PORT="${POSTGRES_PORT:-15432}"
POSTGRES_DB="chainrisk"
POSTGRES_USER="${POSTGRES_USER:-chainrisk}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-chainrisk123}"
POSTGRES_JDBC_URL="jdbc:postgresql://$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

NEO4J_HOST="${NEO4J_HOST:-$DOCKER_HOST_IP}"
NEO4J_BOLT_PORT="${NEO4J_BOLT_PORT:-17687}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-chainrisk123}"
NEO4J_URI="bolt://$NEO4J_HOST:$NEO4J_BOLT_PORT"

# Feature flags
ENABLE_NEO4J_SINK="${ENABLE_NEO4J_SINK:-true}"
NETWORK="${NETWORK:-ethereum}"

cd "$PROJECT_ROOT/processing/batch-processor"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Spark is installed
    if ! command -v spark-submit &> /dev/null; then
        log_error "Spark is not installed"
        log_error "Install with: brew install apache-spark (macOS)"
        exit 1
    fi
    
    # Check if Java is installed
    if ! command -v java &> /dev/null; then
        log_error "Java is not installed"
        exit 1
    fi
    
    # Check if Maven is installed
    if ! command -v mvn &> /dev/null; then
        log_error "Maven is not installed"
        exit 1
    fi
    
    log_info "✓ Prerequisites check passed"
}

# Build batch processor
build_batch_processor() {
    log_info "Building Spark Batch Processor..."
    
    # Build with local profile (includes Spark dependencies)
    mvn clean package -DskipTests -Plocal -q
    
    if [ ! -f "target/batch-processor-1.0.0-SNAPSHOT.jar" ]; then
        log_error "Build failed - JAR not found"
        exit 1
    fi
    
    log_info "✓ Batch processor built successfully"
}

# Run Spark batch processor
run_batch_processor() {
    log_info "Starting Spark Batch Processor (Lambda Batch Layer)..."
    log_info "PostgreSQL: $POSTGRES_JDBC_URL"
    log_info "Neo4j: $NEO4J_URI"
    log_info "Network: $NETWORK"
    log_info "Neo4j Sink: $ENABLE_NEO4J_SINK"
    
    # Ensure logs directory exists
    mkdir -p logs
    
    # Path to log4j2 config
    LOG4J2_CONF="file:$(pwd)/src/main/resources/log4j2.properties"
    
    # Build spark-submit command
    SPARK_CMD="spark-submit \
        --class com.chainrisk.batch.BatchProcessorApp \
        --master 'local[*]' \
        --driver-memory 1g \
        --executor-memory 1g \
        --conf spark.sql.adaptive.enabled=true \
        --conf spark.driver.host=localhost \
        --conf spark.driver.bindAddress=localhost \
        --conf spark.network.timeout=600s \
        --conf spark.executor.heartbeatInterval=60s \
        --conf 'spark.driver.extraJavaOptions=-Dlog4j2.configurationFile=$LOG4J2_CONF -Dio.netty.tryReflectionSetAccessible=true' \
        --conf 'spark.executor.extraJavaOptions=-Dlog4j2.configurationFile=$LOG4J2_CONF' \
        target/batch-processor-1.0.0-SNAPSHOT.jar \
        --jdbc.url '$POSTGRES_JDBC_URL' \
        --jdbc.user '$POSTGRES_USER' \
        --jdbc.password '$POSTGRES_PASSWORD' \
        --neo4j.uri '$NEO4J_URI' \
        --neo4j.user '$NEO4J_USER' \
        --neo4j.password '$NEO4J_PASSWORD' \
        --enable.neo4j.sink '$ENABLE_NEO4J_SINK' \
        --network '$NETWORK'"
    
    # Check if tmux is available
    if command -v tmux &> /dev/null; then
        log_info "Using tmux session: $TMUX_SESSION"
        log_info "To attach: tmux attach -t $TMUX_SESSION"
        log_info "To stop: tmux kill-session -t $TMUX_SESSION"
        
        # Kill existing session if exists
        tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
        
        # Create new tmux session and run Spark
        # Use bash -c to properly handle the command with variables
        tmux new-session -d -s "$TMUX_SESSION" "cd $(pwd) && $SPARK_CMD; echo 'Press enter to exit'; read"
        
        # Wait a moment and check if session is running
        sleep 2
        if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
            log_info "Spark Batch Processor started in tmux session '$TMUX_SESSION'"
            log_info ""
            log_info "Commands:"
            log_info "  View logs:  tmux attach -t $TMUX_SESSION"
            log_info "  Stop Spark: tmux kill-session -t $TMUX_SESSION"
            log_info "  Or use:     make stop-batch"
        else
            log_error "Failed to start tmux session. Running in foreground..."
            eval "$SPARK_CMD"
        fi
        
    else
        log_warn "tmux not installed, running Spark in foreground"
        log_warn "Press Ctrl+C to stop"
        log_warn "Install tmux: brew install tmux (macOS) or apt-get install tmux (Linux)"
        
        # Run Spark job directly
        eval "$SPARK_CMD"
    fi
}

# Main execution
main() {
    log_info "================================================"
    log_info "Spark Batch Processor - Lambda Batch Layer"
    log_info "================================================"
    
    check_prerequisites
    build_batch_processor
    run_batch_processor
    
    log_info "================================================"
    log_info "✅ Spark Batch Processor Started"
    log_info "================================================"
}

main "$@"
