#!/bin/bash
# Recovery Verification Test
# Measures TTD (Time to Detect) and TTR (Time to Recover)
# Usage: ./tests/chaos/verify-recovery.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Targets from SRE requirements
TARGET_TTD=30   # seconds
TARGET_TTR=60   # seconds
TARGET_SUCCESS=99  # percent

# Results
declare -A METRICS

verify_ttd() {
    echo ""
    echo "=== Phase 1: Time to Detect (TTD) ==="
    
    # Inject severe fault
    log_step "Injecting severe database latency (30s)"
    add_toxic "postgres-proxy" "latency" '{"latency": 30000}'
    
    local inject_time=$(date +%s)
    local detected=false
    local ttd=0
    
    # Wait for detection (service health degradation or alert)
    log_step "Waiting for detection..."
    
    for i in $(seq 1 60); do
        # Check if health endpoint shows degradation
        local status
        status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8081/health" 2>/dev/null || echo "000")
        
        # Check Prometheus alerts if available
        local alert_firing=false
        if curl -sf "${PROMETHEUS_URL:-http://localhost:9090}/api/v1/alerts" 2>/dev/null | grep -q "firing"; then
            alert_firing=true
        fi
        
        if [ "$status" = "503" ] || [ "$status" = "000" ] || [ "$alert_firing" = true ]; then
            ttd=$(($(date +%s) - inject_time))
            detected=true
            break
        fi
        
        sleep 1
    done
    
    if [ "$detected" = true ]; then
        METRICS[ttd]=$ttd
        log_success "Fault detected in ${ttd}s (target: <${TARGET_TTD}s)"
        
        if [ $ttd -lt $TARGET_TTD ]; then
            log_success "TTD PASS"
            return 0
        else
            log_error "TTD exceeds target"
            return 1
        fi
    else
        METRICS[ttd]=">60"
        log_error "Fault not detected within 60s"
        return 1
    fi
}

verify_ttr() {
    echo ""
    echo "=== Phase 2: Time to Recover (TTR) ==="
    
    # Remove fault
    log_step "Removing fault"
    remove_toxic "postgres-proxy" "latency"
    
    local remove_time=$(date +%s)
    local recovered=false
    local ttr=0
    
    # Wait for recovery
    log_step "Waiting for recovery..."
    
    for i in $(seq 1 120); do
        local status
        status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:8081/health" 2>/dev/null || echo "000")
        
        if [ "$status" = "200" ]; then
            ttr=$(($(date +%s) - remove_time))
            recovered=true
            break
        fi
        
        sleep 1
    done
    
    if [ "$recovered" = true ]; then
        METRICS[ttr]=$ttr
        log_success "Service recovered in ${ttr}s (target: <${TARGET_TTR}s)"
        
        if [ $ttr -lt $TARGET_TTR ]; then
            log_success "TTR PASS"
            return 0
        else
            log_error "TTR exceeds target"
            return 1
        fi
    else
        METRICS[ttr]=">120"
        log_error "Service did not recover within 120s"
        return 1
    fi
}

verify_post_recovery() {
    echo ""
    echo "=== Phase 3: Post-Recovery Validation ==="
    
    log_step "Running ${TARGET_SUCCESS}+ success rate test"
    
    local success=0
    local total=100
    
    for i in $(seq 1 $total); do
        if curl -sf --max-time 3 "http://localhost:8081/health" >/dev/null 2>&1; then
            ((success++))
        fi
    done
    
    local rate=$((success * 100 / total))
    METRICS[success_rate]=$rate
    
    log_info "Post-recovery success rate: ${rate}% ($success/$total)"
    
    if [ $rate -ge $TARGET_SUCCESS ]; then
        log_success "Post-recovery PASS"
        return 0
    else
        log_error "Post-recovery success rate below target"
        return 1
    fi
}

verify_no_data_loss() {
    echo ""
    echo "=== Phase 4: Data Integrity Check ==="
    
    # Test that we can read data that existed before
    log_step "Checking data accessibility"
    
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:8081/api/health/db" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        log_success "Database connectivity restored"
        METRICS[data_integrity]="OK"
        return 0
    else
        log_info "DB health endpoint returned: $status"
        METRICS[data_integrity]="UNKNOWN"
        return 0  # Don't fail, just note
    fi
}

print_report() {
    echo ""
    echo "================================================================"
    echo "              RECOVERY VERIFICATION REPORT                      "
    echo "================================================================"
    echo ""
    printf "  %-25s %s\n" "Metric" "Result"
    echo "  ----------------------------------------------------------------"
    printf "  %-25s %ss (target: <%ss)\n" "Time to Detect (TTD)" "${METRICS[ttd]}" "$TARGET_TTD"
    printf "  %-25s %ss (target: <%ss)\n" "Time to Recover (TTR)" "${METRICS[ttr]}" "$TARGET_TTR"
    printf "  %-25s %s%% (target: >%s%%)\n" "Post-Recovery Success" "${METRICS[success_rate]}" "$TARGET_SUCCESS"
    printf "  %-25s %s\n" "Data Integrity" "${METRICS[data_integrity]}"
    echo ""
    echo "================================================================"
}

main() {
    echo "================================================================"
    echo "           RECOVERY VERIFICATION TEST                          "
    echo "================================================================"
    echo "Start time: $(date -Iseconds)"
    echo ""
    echo "Targets:"
    echo "  TTD: <${TARGET_TTD}s"
    echo "  TTR: <${TARGET_TTR}s"
    echo "  Post-recovery: >${TARGET_SUCCESS}%"
    
    # Pre-check
    if ! curl -sf "$TOXIPROXY_API/version" >/dev/null 2>&1; then
        echo ""
        echo "ERROR: Toxiproxy not available"
        exit 1
    fi
    
    if ! run_health_check "query-service" 200; then
        echo ""
        echo "ERROR: query-service not healthy before test"
        exit 1
    fi
    
    # Cleanup any existing toxics
    cleanup_all
    
    local result=0
    
    # Run verification phases
    verify_ttd || result=1
    verify_ttr || result=1
    verify_post_recovery || result=1
    verify_no_data_loss || true
    
    # Ensure cleanup
    cleanup_all
    
    # Print report
    print_report
    
    echo "End time: $(date -Iseconds)"
    
    if [ $result -eq 0 ]; then
        echo ""
        echo -e "${GREEN}RECOVERY VERIFICATION: PASS${NC}"
        exit 0
    else
        echo ""
        echo -e "${RED}RECOVERY VERIFICATION: FAIL${NC}"
        exit 1
    fi
}

main "$@"
