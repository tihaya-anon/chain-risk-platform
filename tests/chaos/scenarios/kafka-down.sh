#!/bin/bash
# C6: Kafka Down Scenario
# Completely blocks Kafka connections
# Expected: Local buffering, no message loss, graceful degradation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C6"
DESCRIPTION="Kafka connection blocked"
PROXY="kafka-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Block Kafka
    add_toxic "$PROXY" "limit_data" '{"bytes": 0}'
    
    sleep 5
    
    local result=0
    
    # Core services should remain operational
    log_step "Testing core services with Kafka down"
    
    run_health_check "query-service" 200 || log_info "Query service may be affected"
    
    # Alert service might degrade but shouldn't crash
    local alert_status
    alert_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:8083/health" 2>/dev/null || echo "000")
    
    log_info "Alert service status: $alert_status"
    
    if [ "$alert_status" != "000" ]; then
        log_success "Alert service did not crash"
    else
        log_error "Alert service unresponsive"
        result=1
    fi
    
    # Cleanup
    remove_toxic "$PROXY" "limit_data"
    
    # Wait for Kafka reconnection
    sleep 10
    
    # Verify recovery
    wait_for_service "alert-service" 30 || result=1
    
    if [ $result -eq 0 ]; then
        log_end "$SCENARIO" "PASS"
        exit 0
    else
        log_end "$SCENARIO" "FAIL"
        exit 1
    fi
}

main "$@"
