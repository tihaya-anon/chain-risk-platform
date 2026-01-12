#!/bin/bash
# Run all chaos scenarios
# Usage: ./tests/chaos/run-all.sh [scenario]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

SCENARIOS=(
    "db-latency"
    "db-timeout"
    "db-down"
    "redis-down"
    "kafka-latency"
    "kafka-down"
    "network-jitter"
    "bandwidth-limit"
)

declare -A RESULTS

run_scenario() {
    local scenario=$1
    local script="$SCRIPT_DIR/scenarios/${scenario}.sh"
    
    if [ ! -f "$script" ]; then
        echo "ERROR: Scenario not found: $script"
        RESULTS[$scenario]="NOT_FOUND"
        return 1
    fi
    
    chmod +x "$script"
    
    if "$script"; then
        RESULTS[$scenario]="PASS"
        return 0
    else
        RESULTS[$scenario]="FAIL"
        return 1
    fi
}

print_summary() {
    echo ""
    echo "================================================================"
    echo "                    CHAOS TEST SUMMARY                          "
    echo "================================================================"
    
    local passed=0
    local failed=0
    local total=${#SCENARIOS[@]}
    
    for scenario in "${SCENARIOS[@]}"; do
        local status=${RESULTS[$scenario]:-"NOT_RUN"}
        local color=$NC
        
        case $status in
            "PASS") 
                color=$GREEN
                ((passed++))
                ;;
            "FAIL")
                color=$RED
                ((failed++))
                ;;
            *)
                color=$YELLOW
                ;;
        esac
        
        printf "  %-20s %b%s%b\n" "$scenario" "$color" "$status" "$NC"
    done
    
    echo "----------------------------------------------------------------"
    echo "  Total: $total | Passed: $passed | Failed: $failed"
    echo "================================================================"
    
    if [ $failed -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

main() {
    echo "================================================================"
    echo "              CHAOS ENGINEERING TEST SUITE                      "
    echo "================================================================"
    echo "Start time: $(date -Iseconds)"
    echo ""
    
    # Check Toxiproxy
    if ! curl -sf "$TOXIPROXY_API/version" >/dev/null 2>&1; then
        echo "ERROR: Toxiproxy not available at $TOXIPROXY_API"
        echo "Start with: docker compose -f infra/compose/chaos.yml up -d"
        exit 1
    fi
    
    # Cleanup before starting
    cleanup_all
    
    # Run specific scenario or all
    if [ -n "$1" ]; then
        run_scenario "$1"
    else
        for scenario in "${SCENARIOS[@]}"; do
            echo ""
            run_scenario "$scenario" || true
            
            # Cleanup between scenarios
            cleanup_all
            sleep 2
        done
    fi
    
    # Final cleanup
    cleanup_all
    
    # Summary
    print_summary
}

main "$@"
