#!/bin/bash
# C7: Network Jitter Scenario
# Adds variable latency (jitter) to simulate unstable network
# Expected: Retries work correctly, no request failures

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C7"
DESCRIPTION="Network jitter ±100ms"
PROXY="postgres-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Baseline
    log_step "Recording baseline"
    baseline=$(measure_latency "http://localhost:8081/health" 5)
    
    # Inject jitter
    add_toxic "$PROXY" "latency" '{"latency": 50, "jitter": 100}'
    
    sleep 2
    
    local result=0
    local success_count=0
    local total_requests=20
    
    # Run multiple requests, count successes
    log_step "Testing with network jitter ($total_requests requests)"
    
    for i in $(seq 1 $total_requests); do
        if curl -sf --max-time 5 "http://localhost:8081/health" >/dev/null 2>&1; then
            ((success_count++))
        fi
    done
    
    local success_rate=$((success_count * 100 / total_requests))
    log_info "Success rate: ${success_rate}% ($success_count/$total_requests)"
    
    # With retries, we should have high success rate
    if [ $success_rate -ge 90 ]; then
        log_success "High success rate with jitter"
    else
        log_error "Too many failures under jitter"
        result=1
    fi
    
    # Measure average latency variance
    log_step "Measuring latency variance"
    measure_latency "http://localhost:8081/health" 5
    
    # Cleanup
    remove_toxic "$PROXY" "latency"
    
    if [ $result -eq 0 ]; then
        log_end "$SCENARIO" "PASS"
        exit 0
    else
        log_end "$SCENARIO" "FAIL"
        exit 1
    fi
}

main "$@"
