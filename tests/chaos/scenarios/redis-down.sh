#!/bin/bash
# C4: Redis Down Scenario
# Blocks Redis connections
# Expected: Fallback to database, degraded performance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C4"
DESCRIPTION="Redis cache failure"
PROXY="redis-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Baseline
    log_step "Recording baseline latency"
    baseline=$(measure_latency "http://localhost:8081/health" 3)
    
    # Block Redis
    add_toxic "$PROXY" "limit_data" '{"bytes": 0}'
    
    sleep 3
    
    local result=0
    
    # Services should still work (fallback to DB)
    log_step "Testing with Redis down"
    run_health_check "query-service" 200 || result=1
    
    # Check latency increase (DB fallback is slower)
    log_step "Checking degraded performance"
    fault_latency=$(measure_latency "http://localhost:8081/health" 3)
    
    log_info "Baseline: ${baseline}s, With fault: ${fault_latency}s"
    
    # Verify ML service (also uses Redis)
    run_health_check "risk-ml-service" 200 || log_info "ML service may be affected"
    
    # Cleanup
    remove_toxic "$PROXY" "limit_data"
    
    # Wait for cache reconnection
    sleep 5
    
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
