#!/bin/bash
# C1: Database Latency Scenario
# Injects 500ms latency to PostgreSQL connections
# Expected: Services remain functional but slower

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C1"
DESCRIPTION="Database latency 500ms"
PROXY="postgres-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Baseline measurement
    log_step "Recording baseline latency"
    baseline=$(measure_latency "http://localhost:8081/health")
    
    # Inject fault
    add_toxic "$PROXY" "latency" '{"latency": 500, "jitter": 100}'
    
    sleep 2
    
    # Verify services still work
    local result=0
    
    run_health_check "query-service" 200 || result=1
    run_health_check "alert-service" 200 || result=1
    
    # Verify increased latency
    log_step "Measuring latency under fault"
    fault_latency=$(measure_latency "http://localhost:8081/health")
    
    if (( $(echo "$fault_latency > $baseline" | bc -l) )); then
        log_success "Latency increased as expected"
    else
        log_error "Latency did not increase"
        result=1
    fi
    
    # Cleanup
    remove_toxic "$PROXY" "latency"
    
    # Report
    if [ $result -eq 0 ]; then
        log_end "$SCENARIO" "PASS"
        exit 0
    else
        log_end "$SCENARIO" "FAIL"
        exit 1
    fi
}

main "$@"
