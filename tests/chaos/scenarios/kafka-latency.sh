#!/bin/bash
# C5: Kafka Latency Scenario
# Injects 2s latency to Kafka connections
# Expected: Message processing slows, backoff mechanisms activate

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

SCENARIO="C5"
DESCRIPTION="Kafka latency 2s"
PROXY="kafka-proxy"

main() {
    log_start "$SCENARIO" "$DESCRIPTION"
    
    # Inject Kafka latency
    add_toxic "$PROXY" "latency" '{"latency": 2000, "jitter": 500}'
    
    sleep 3
    
    local result=0
    
    # Services should still be healthy
    run_health_check "alert-service" 200 || result=1
    
    # Check if services handle Kafka slowness
    log_step "Testing alert service under Kafka latency"
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:8083/health" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        log_success "Alert service healthy despite Kafka latency"
    else
        log_error "Alert service impacted: $status"
        result=1
    fi
    
    # Check consumer lag metric if available
    verify_prometheus_metric "kafka_consumergroup_lag" || log_info "Kafka lag metric not available"
    
    # Cleanup
    remove_toxic "$PROXY" "latency"
    
    sleep 3
    
    if [ $result -eq 0 ]; then
        log_end "$SCENARIO" "PASS"
        exit 0
    else
        log_end "$SCENARIO" "FAIL"
        exit 1
    fi
}

main "$@"
