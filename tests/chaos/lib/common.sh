#!/bin/bash
# Common utilities for chaos testing scenarios

TOXIPROXY_API="${TOXIPROXY_API:-http://localhost:8474}"

# Service ports
declare -A SERVICE_PORTS=(
    ["query-service"]="8081"
    ["risk-ml-service"]="8082"
    ["alert-service"]="8083"
    ["graph-service"]="8084"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_start() {
    local scenario=$1
    local description=$2
    echo ""
    echo "================================================================"
    echo -e "${YELLOW}[$scenario] $description${NC}"
    echo "================================================================"
    echo "Start time: $(date -Iseconds)"
}

log_end() {
    local scenario=$1
    local status=$2
    echo ""
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}[$scenario] PASS${NC}"
    else
        echo -e "${RED}[$scenario] FAIL${NC}"
    fi
    echo "End time: $(date -Iseconds)"
    echo "================================================================"
}

log_step() {
    echo "  → $1"
}

log_info() {
    echo -e "  ${YELLOW}ℹ${NC} $1"
}

log_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "  ${RED}✗${NC} $1"
}

add_toxic() {
    local proxy=$1
    local type=$2
    local params=$3
    local name="${type}_test"
    
    log_step "Adding toxic: $type to $proxy"
    
    local response
    response=$(curl -sf -X POST "$TOXIPROXY_API/proxies/$proxy/toxics" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$name\",\"type\":\"$type\",\"attributes\":$params}" 2>&1)
    
    if [ $? -eq 0 ]; then
        log_success "Toxic added: $name"
        return 0
    else
        log_error "Failed to add toxic: $response"
        return 1
    fi
}

remove_toxic() {
    local proxy=$1
    local type=$2
    local name="${type}_test"
    
    log_step "Removing toxic: $type from $proxy"
    
    curl -sf -X DELETE "$TOXIPROXY_API/proxies/$proxy/toxics/$name" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_success "Toxic removed: $name"
    else
        log_info "Toxic may not exist: $name"
    fi
}

remove_all_toxics() {
    local proxy=$1
    
    log_step "Removing all toxics from $proxy"
    
    local toxics
    toxics=$(curl -sf "$TOXIPROXY_API/proxies/$proxy/toxics" | jq -r '.[].name' 2>/dev/null)
    
    for toxic in $toxics; do
        curl -sf -X DELETE "$TOXIPROXY_API/proxies/$proxy/toxics/$toxic" >/dev/null 2>&1
    done
}

run_health_check() {
    local service=$1
    local expected=${2:-200}
    local port=${SERVICE_PORTS[$service]}
    
    log_step "Health check: $service (expect $expected)"
    
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null || echo "000")
    
    if [ "$status" -eq "$expected" ]; then
        log_success "Health check passed: $status"
        return 0
    else
        log_error "Health check failed: $status (expected $expected)"
        return 1
    fi
}

run_api_test() {
    local endpoint=$1
    local expected=${2:-200}
    shift 2
    local extra_args="$@"
    
    log_step "API test: $endpoint (expect $expected)"
    
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" $extra_args "$endpoint" 2>/dev/null || echo "000")
    
    if [ "$status" -eq "$expected" ]; then
        log_success "API test passed: $status"
        return 0
    else
        log_error "API test failed: $status (expected $expected)"
        return 1
    fi
}

measure_latency() {
    local endpoint=$1
    local count=${2:-5}
    
    log_step "Measuring latency ($count requests)"
    
    local total=0
    local success=0
    
    for i in $(seq 1 $count); do
        local time
        time=$(curl -sf -o /dev/null -w "%{time_total}" "$endpoint" 2>/dev/null || echo "0")
        if [ "$time" != "0" ]; then
            total=$(echo "$total + $time" | bc)
            ((success++))
        fi
    done
    
    if [ $success -gt 0 ]; then
        local avg=$(echo "scale=3; $total / $success" | bc)
        log_info "Average latency: ${avg}s ($success/$count successful)"
        echo "$avg"
    else
        log_error "All requests failed"
        echo "0"
    fi
}

wait_for_service() {
    local service=$1
    local timeout=${2:-60}
    local port=${SERVICE_PORTS[$service]}
    
    log_step "Waiting for $service (timeout: ${timeout}s)"
    
    for i in $(seq 1 $timeout); do
        if curl -sf "http://localhost:$port/health" >/dev/null 2>&1; then
            log_success "$service is healthy after ${i}s"
            return 0
        fi
        sleep 1
    done
    
    log_error "$service did not recover in ${timeout}s"
    return 1
}

wait_for_alert() {
    local alert_name=$1
    local timeout=${2:-60}
    local prometheus_url="${PROMETHEUS_URL:-http://localhost:9090}"
    
    log_step "Waiting for alert: $alert_name (timeout: ${timeout}s)"
    
    for i in $(seq 1 $timeout); do
        local firing
        firing=$(curl -sf "$prometheus_url/api/v1/alerts" | jq -r ".data.alerts[] | select(.labels.alertname==\"$alert_name\") | .state" 2>/dev/null)
        
        if [ "$firing" = "firing" ]; then
            log_success "Alert $alert_name fired after ${i}s"
            return 0
        fi
        sleep 1
    done
    
    log_info "Alert $alert_name did not fire in ${timeout}s"
    return 1
}

cleanup_all() {
    log_step "Cleaning up all toxics"
    
    for proxy in postgres-proxy redis-proxy kafka-proxy neo4j-proxy; do
        remove_all_toxics "$proxy"
    done
}

verify_prometheus_metric() {
    local metric=$1
    local prometheus_url="${PROMETHEUS_URL:-http://localhost:9090}"
    
    log_step "Checking metric: $metric"
    
    local result
    result=$(curl -sf "$prometheus_url/api/v1/query?query=$metric" | jq -r '.data.result | length' 2>/dev/null)
    
    if [ "$result" != "0" ] && [ -n "$result" ]; then
        log_success "Metric found: $metric"
        return 0
    else
        log_info "Metric not found: $metric"
        return 1
    fi
}
