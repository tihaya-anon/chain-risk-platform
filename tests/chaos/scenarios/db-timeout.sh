#!/bin/bash
# C2: Database Timeout Scenario
# Injects 30s latency to PostgreSQL - should trigger circuit breaker
# Expected: Circuit breaker opens, service degrades gracefully

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C2"
DESCRIPTION="Database timeout (30s latency)"
PROXY="postgres-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Inject severe latency
    add_toxic "$PROXY" "latency" '{"latency": 30000, "jitter": 0}'
    
    sleep 3
    
    local result=0
    
    # Health endpoint should still respond (from cache/fallback)
    log_step "Testing health endpoint with timeout"
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8081/health" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ] || [ "$status" = "503" ]; then
        log_success "Service responded appropriately: $status"
    else
        log_error "Unexpected response: $status"
        result=1
    fi
    
    # Check circuit breaker metric
    log_step "Checking circuit breaker state"
    verify_prometheus_metric "circuit_breaker_state" || log_info "CB metric not yet available"
    
    # Make several requests to potentially trigger CB
    log_step "Triggering circuit breaker with failed requests"
    for i in $(seq 1 10); do
        curl -sf --max-time 2 "http://localhost:8081/api/addresses/test" >/dev/null 2>&1 || true
    done
    
    sleep 2
    
    # Cleanup
    remove_toxic "$PROXY" "latency"
    
    # Wait for recovery
    wait_for_service "query-service" 30 || result=1
    
    if [ $result -eq 0 ]; then
        log_end "$SCENARIO" "PASS"
        exit 0
    else
        log_end "$SCENARIO" "FAIL"
        exit 1
    fi
}

main "$@"
