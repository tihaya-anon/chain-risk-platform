#!/bin/bash
# C3: Database Down Scenario
# Completely blocks PostgreSQL connections
# Expected: Graceful error handling, no crash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C3"
DESCRIPTION="Database connection blocked"
PROXY="postgres-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Block all data
    add_toxic "$PROXY" "limit_data" '{"bytes": 0}'
    
    sleep 3
    
    local result=0
    
    # Health should indicate degraded or still respond
    log_step "Testing service behavior with DB down"
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8081/health" 2>/dev/null || echo "000")
    
    log_info "Health endpoint returned: $status"
    
    # Any response (200, 503, etc) is acceptable - crash (000) is not
    if [ "$status" != "000" ]; then
        log_success "Service handled DB failure gracefully"
    else
        log_error "Service may have crashed or timed out completely"
        result=1
    fi
    
    # Test API endpoint returns proper error
    log_step "Testing API error handling"
    local api_status
    api_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8081/api/addresses/0x123" 2>/dev/null || echo "000")
    
    log_info "API endpoint returned: $api_status"
    
    if [ "$api_status" = "503" ] || [ "$api_status" = "500" ] || [ "$api_status" = "504" ]; then
        log_success "API returned appropriate error code"
    elif [ "$api_status" != "000" ]; then
        log_info "API returned: $api_status"
    else
        log_error "API completely failed"
        result=1
    fi
    
    # Cleanup
    remove_toxic "$PROXY" "limit_data"
    
    # Wait for recovery
    sleep 2
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
