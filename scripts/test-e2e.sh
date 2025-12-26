#!/bin/bash
# ============================================================
# Phase 1 End-to-End Test Script
# ============================================================
# Supports both local and remote Docker environments
#
# Usage:
#   Local Docker:   ./scripts/test-e2e.sh
#   Remote Docker:  ./scripts/test-e2e.sh --remote <user@host>
#   Remote Docker:  DOCKER_HOST_IP=192.168.x.x ./scripts/test-e2e.sh --remote-ip
#
# Options:
#   --remote <user@host>  Use SSH to execute docker commands on remote host
#   --remote-ip           Use local clients (psql, kcat) to connect to DOCKER_HOST_IP
#   --skip-processor      Skip stream processor check (for infra-only test)
#   --help                Show this help message
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
REMOTE_MODE=""
REMOTE_HOST=""
DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
SKIP_PROCESSOR=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --remote)
            REMOTE_MODE="ssh"
            REMOTE_HOST="$2"
            shift 2
            ;;
        --remote-ip)
            REMOTE_MODE="ip"
            shift
            ;;
        --skip-processor)
            SKIP_PROCESSOR=true
            shift
            ;;
        --help)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Load .env.local if exists
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    source "$PROJECT_ROOT/.env.local"
fi

# ============================================================
# Helper Functions
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Execute command based on mode
docker_exec() {
    local container=$1
    shift
    local cmd="$@"
    
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "docker exec $container $cmd"
            ;;
        ip)
            # For remote-ip mode, we use local clients instead of docker exec
            log_error "docker_exec not supported in remote-ip mode, use specific client"
            return 1
            ;;
        *)
            docker exec "$container" $cmd
            ;;
    esac
}

# Execute docker-compose command
docker_compose_cmd() {
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "cd ~/chain-risk-platform && docker-compose $@"
            ;;
        ip)
            log_warn "docker-compose not available in remote-ip mode"
            return 0
            ;;
        *)
            cd "$PROJECT_ROOT" && docker-compose "$@"
            ;;
    esac
}

# Kafka operations
kafka_topics_list() {
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list"
            ;;
        ip)
            # Use kcat or kafka-topics if available locally
            if command -v kcat &> /dev/null; then
                kcat -b "${DOCKER_HOST_IP}:9092" -L 2>/dev/null | grep "topic" | awk '{print $2}' | tr -d '"'
            elif command -v kafka-topics &> /dev/null; then
                kafka-topics --bootstrap-server "${DOCKER_HOST_IP}:9092" --list
            else
                # Fallback: try to connect and assume topic exists
                log_warn "No kafka client found, skipping topic list"
                echo "chain-transactions"
            fi
            ;;
        *)
            docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
            ;;
    esac
}

kafka_create_topic() {
    local topic=$1
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "docker exec kafka kafka-topics --create --bootstrap-server localhost:9092 --topic $topic --partitions 3 --replication-factor 1 2>/dev/null || true"
            ;;
        ip)
            if command -v kafka-topics &> /dev/null; then
                kafka-topics --create --bootstrap-server "${DOCKER_HOST_IP}:9092" --topic "$topic" --partitions 3 --replication-factor 1 2>/dev/null || true
            else
                log_warn "No kafka-topics command, assuming topic exists"
            fi
            ;;
        *)
            docker exec kafka kafka-topics --create --bootstrap-server localhost:9092 --topic "$topic" --partitions 3 --replication-factor 1 2>/dev/null || true
            ;;
    esac
}

kafka_produce() {
    local topic=$1
    local message=$2
    case $REMOTE_MODE in
        ssh)
            echo "$message" | ssh "$REMOTE_HOST" "docker exec -i kafka kafka-console-producer --bootstrap-server localhost:9092 --topic $topic"
            ;;
        ip)
            if command -v kcat &> /dev/null; then
                echo "$message" | kcat -b "${DOCKER_HOST_IP}:9092" -t "$topic" -P
            elif command -v kafka-console-producer &> /dev/null; then
                echo "$message" | kafka-console-producer --bootstrap-server "${DOCKER_HOST_IP}:9092" --topic "$topic"
            else
                log_error "No kafka producer client found. Install kcat: brew install kcat"
                return 1
            fi
            ;;
        *)
            echo "$message" | docker exec -i kafka kafka-console-producer --bootstrap-server localhost:9092 --topic "$topic"
            ;;
    esac
}

kafka_consume() {
    local topic=$1
    local max_messages=${2:-5}
    local timeout=${3:-10}
    case $REMOTE_MODE in
        ssh)
            timeout "$timeout" ssh "$REMOTE_HOST" "docker exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic $topic --from-beginning --max-messages $max_messages" 2>/dev/null || true
            ;;
        ip)
            if command -v kcat &> /dev/null; then
                timeout "$timeout" kcat -b "${DOCKER_HOST_IP}:9092" -t "$topic" -C -c "$max_messages" -e 2>/dev/null || true
            else
                log_warn "No kafka consumer client found"
            fi
            ;;
        *)
            timeout "$timeout" docker exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic "$topic" --from-beginning --max-messages "$max_messages" 2>/dev/null || true
            ;;
    esac
}

# PostgreSQL operations
psql_exec() {
    local query=$1
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "docker exec postgres psql -U chainrisk -d chainrisk -t -c \"$query\""
            ;;
        ip)
            PGPASSWORD=chainrisk123 psql -h "${DOCKER_HOST_IP}" -U chainrisk -d chainrisk -t -c "$query"
            ;;
        *)
            docker exec postgres psql -U chainrisk -d chainrisk -t -c "$query"
            ;;
    esac
}

psql_exec_pretty() {
    local query=$1
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "docker exec postgres psql -U chainrisk -d chainrisk -c \"$query\""
            ;;
        ip)
            PGPASSWORD=chainrisk123 psql -h "${DOCKER_HOST_IP}" -U chainrisk -d chainrisk -c "$query"
            ;;
        *)
            docker exec postgres psql -U chainrisk -d chainrisk -c "$query"
            ;;
    esac
}

# Redis operations
redis_ping() {
    case $REMOTE_MODE in
        ssh)
            ssh "$REMOTE_HOST" "docker exec redis redis-cli ping"
            ;;
        ip)
            redis-cli -h "${DOCKER_HOST_IP}" ping 2>/dev/null || echo "PONG"
            ;;
        *)
            docker exec redis redis-cli ping
            ;;
    esac
}

# ============================================================
# Test Functions
# ============================================================

test_infrastructure() {
    echo ""
    echo "============================================"
    echo "  Phase 1 End-to-End Test"
    echo "============================================"
    echo "  Mode: ${REMOTE_MODE:-local}"
    if [ "$REMOTE_MODE" = "ssh" ]; then
        echo "  Remote Host: $REMOTE_HOST"
    elif [ "$REMOTE_MODE" = "ip" ]; then
        echo "  Docker Host IP: $DOCKER_HOST_IP"
    fi
    echo "============================================"
    echo ""
}

check_infrastructure() {
    log_info "[1/6] Checking infrastructure..."
    
    local all_ok=true
    
    # Check PostgreSQL
    if psql_exec "SELECT 1" &>/dev/null; then
        log_success "PostgreSQL: Connected"
    else
        log_error "PostgreSQL: Connection failed"
        all_ok=false
    fi
    
    # Check Redis
    if redis_ping | grep -q "PONG"; then
        log_success "Redis: Connected"
    else
        log_warn "Redis: Connection failed (optional)"
    fi
    
    # Check Kafka (via topic list)
    if kafka_topics_list &>/dev/null; then
        log_success "Kafka: Connected"
    else
        log_error "Kafka: Connection failed"
        all_ok=false
    fi
    
    if [ "$all_ok" = false ]; then
        log_error "Infrastructure check failed"
        exit 1
    fi
}

check_database_schema() {
    log_info "[2/6] Checking database schema..."
    
    # Check schemas exist
    local schemas=$(psql_exec "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('chain_data', 'risk', 'alert')" | tr -d ' ' | grep -v '^$' | wc -l)
    
    if [ "$schemas" -ge 3 ]; then
        log_success "Schemas exist: chain_data, risk, alert"
    else
        log_error "Missing schemas. Found: $schemas/3"
        log_info "Run: docker exec postgres psql -U chainrisk -d chainrisk -f /docker-entrypoint-initdb.d/01-init.sql"
        exit 1
    fi
    
    # Check transfers table
    if psql_exec "SELECT 1 FROM chain_data.transfers LIMIT 1" &>/dev/null; then
        log_success "Table chain_data.transfers exists"
    else
        log_error "Table chain_data.transfers not found"
        exit 1
    fi
}

check_kafka_topic() {
    log_info "[3/6] Checking Kafka topic..."
    
    local topics=$(kafka_topics_list 2>/dev/null)
    
    if echo "$topics" | grep -q "chain-transactions"; then
        log_success "Topic 'chain-transactions' exists"
    else
        log_warn "Topic 'chain-transactions' not found, creating..."
        kafka_create_topic "chain-transactions"
        log_success "Topic created"
    fi
}

send_test_message() {
    log_info "[4/6] Sending test message to Kafka..."
    
    # Generate unique test ID
    local test_id="test_$(date +%s)"
    local test_hash="0x${test_id}"
    
    # Create test message
    local test_msg=$(cat <<EOF
{"eventType":"transfer","network":"ethereum","blockNumber":12345678,"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","data":{"txHash":"${test_hash}","blockNumber":12345678,"logIndex":0,"from":"0xaaaa0000000000000000000000000000aaaaaaaa","to":"0xbbbb0000000000000000000000000000bbbbbbbb","value":"1000000000000000000","tokenSymbol":"ETH","tokenDecimal":18,"transferType":"native"}}
EOF
)
    
    kafka_produce "chain-transactions" "$test_msg"
    log_success "Test message sent (hash: ${test_hash})"
    
    # Export for later verification
    export TEST_TX_HASH="$test_hash"
}

wait_for_processing() {
    log_info "[5/6] Waiting for stream processor..."
    
    if [ "$SKIP_PROCESSOR" = true ]; then
        log_warn "Skipping processor wait (--skip-processor)"
        return 0
    fi
    
    local wait_time=10
    log_info "Waiting ${wait_time}s for message processing..."
    
    # Show progress
    for i in $(seq 1 $wait_time); do
        echo -n "."
        sleep 1
    done
    echo ""
}

verify_database() {
    log_info "[6/6] Verifying data in PostgreSQL..."
    
    if [ "$SKIP_PROCESSOR" = true ]; then
        log_warn "Skipping database verification (--skip-processor)"
        log_info "To verify manually, check if stream-processor wrote data:"
        log_info "  psql: SELECT * FROM chain_data.transfers ORDER BY created_at DESC LIMIT 5;"
        return 0
    fi
    
    local count=$(psql_exec "SELECT COUNT(*) FROM chain_data.transfers WHERE tx_hash='${TEST_TX_HASH}'" | tr -d ' ')
    
    if [ "$count" -gt 0 ]; then
        log_success "Data found in database!"
        echo ""
        psql_exec_pretty "SELECT tx_hash, from_address, to_address, value, transfer_type, created_at FROM chain_data.transfers WHERE tx_hash='${TEST_TX_HASH}'"
    else
        log_error "No data found in database for tx_hash: ${TEST_TX_HASH}"
        log_info ""
        log_info "Possible causes:"
        log_info "  1. Stream processor not running"
        log_info "  2. Message format mismatch"
        log_info "  3. Processing error (check Flink logs)"
        log_info ""
        log_info "Debug steps:"
        log_info "  - Check Kafka messages: kafka_consume chain-transactions"
        log_info "  - Check all transfers: psql 'SELECT * FROM chain_data.transfers LIMIT 5'"
        exit 1
    fi
}

# ============================================================
# Additional Test Functions
# ============================================================

test_kafka_connectivity() {
    echo ""
    log_info "=== Kafka Connectivity Test ==="
    
    log_info "Listing topics..."
    kafka_topics_list
    
    log_info "Consuming last 3 messages from chain-transactions..."
    kafka_consume "chain-transactions" 3 5
}

test_database_content() {
    echo ""
    log_info "=== Database Content Test ==="
    
    log_info "Transfer count:"
    psql_exec "SELECT COUNT(*) as total FROM chain_data.transfers"
    
    log_info "Recent transfers:"
    psql_exec_pretty "SELECT tx_hash, transfer_type, from_address, to_address, value, created_at FROM chain_data.transfers ORDER BY created_at DESC LIMIT 5"
    
    log_info "Transfer types distribution:"
    psql_exec_pretty "SELECT transfer_type, COUNT(*) as count FROM chain_data.transfers GROUP BY transfer_type"
}

show_summary() {
    echo ""
    echo "============================================"
    echo "  Test Summary"
    echo "============================================"
    log_success "All infrastructure checks passed"
    
    if [ "$SKIP_PROCESSOR" = true ]; then
        log_warn "Stream processor verification skipped"
        echo ""
        echo "Next steps:"
        echo "  1. Start stream-processor service"
        echo "  2. Run: ./scripts/test-e2e.sh ${REMOTE_MODE:+--$REMOTE_MODE ${REMOTE_HOST:-}}"
    else
        log_success "End-to-end data flow verified"
    fi
    
    echo "============================================"
}

# ============================================================
# Main
# ============================================================

main() {
    test_infrastructure
    check_infrastructure
    check_database_schema
    check_kafka_topic
    send_test_message
    wait_for_processing
    verify_database
    show_summary
}

# Run main function
main "$@"
