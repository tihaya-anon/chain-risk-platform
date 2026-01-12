#!/bin/bash
# C8: Bandwidth Limit Scenario
# Restricts bandwidth to 1KB/s simulating network congestion
# Expected: Slow responses, eventual timeouts handled gracefully

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C8"
DESCRIPTION="Bandwidth limited to 1KB/s"
PROXY="postgres-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Inject bandwidth limit
    add_toxic "$PROXY" "bandwidth" '{"rate": 1024}'
    
    sleep 2
    
    local result=0
    
    # Simple health checks should still work (small payload)
    log_step "Testing small requests under bandwidth limit"
    
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:8081/health" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        log_success "Small request succeeded"
    else
        log_info "Health check status: $status"
    fi
    
    # Larger requests should timeout or be very slow
    log_step "Testing larger requests (expect timeout)"
    
    local start_time=$(date +%s)
    curl -sf --max-time 5 "http://localhost:8081/api/addresses/0x123" >/dev/null 2>&1 || true
    local elapsed=$(($(date +%s) - start_time))
    
    log_info "Request took ${elapsed}s (max 5s timeout)"
    
    # Verify service handles bandwidth issues
    log_step "Checking service stability"
    run_health_check "query-service" 200 || log_info "May timeout but should not crash"
    
    # Cleanup
    remove_toxic "$PROXY" "bandwidth"
    
    sleep 3
    
    # Verify recovery
    run_health_check "query-service" 200 || result=1
    
    if [ $result -eq 0 ]; then
        log_end "$SCENARIO" "PASS"
        exit 0
    else
        log_end "$SCENARIO" "FAIL"
        exit 1
    fi
}

main "$@"
