#!/bin/bash
# Performance Test Suite Runner
# Owner: Worker C (Phase 15)
#
# Runs all performance test scenarios and collects results
# Usage: ./run-all.sh [--quick] [--skip-sustained]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${RESULTS_DIR}/run-${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
QUICK_MODE=false
SKIP_SUSTAINED=false
for arg in "$@"; do
    case $arg in
        --quick)
            QUICK_MODE=true
            SKIP_SUSTAINED=true
            ;;
        --skip-sustained)
            SKIP_SUSTAINED=true
            ;;
    esac
done

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}!${NC} $1" | tee -a "$LOG_FILE"
}

# Setup
mkdir -p "$RESULTS_DIR"

echo "
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PERFORMANCE TEST SUITE                                     ║
║                    Chain Risk Platform v0.11.0                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
" | tee "$LOG_FILE"

log "Started: $(date)"
log "Results directory: ${RESULTS_DIR}"
log "Quick mode: ${QUICK_MODE}"
log "Skip sustained: ${SKIP_SUSTAINED}"
echo "" | tee -a "$LOG_FILE"

# Check k6 is installed
if ! command -v k6 &> /dev/null; then
    error "k6 is not installed. Install with: brew install k6"
    exit 1
fi

# Check environment
if [ -z "$DOCKER_HOST_IP" ]; then
    warn "DOCKER_HOST_IP not set, using localhost"
    export DOCKER_HOST_IP="localhost"
fi

# Track results
PASSED=0
FAILED=0
SKIPPED=0
declare -A SCENARIO_RESULTS

run_scenario() {
    local name=$1
    local file=$2
    local duration=$3
    
    log "Running ${name}... (${duration})"
    
    if k6 run "${SCRIPT_DIR}/${file}" 2>&1 | tee -a "$LOG_FILE"; then
        success "${name} completed"
        SCENARIO_RESULTS[$name]="PASS"
        ((PASSED++))
    else
        error "${name} failed"
        SCENARIO_RESULTS[$name]="FAIL"
        ((FAILED++))
    fi
    
    echo "" | tee -a "$LOG_FILE"
}

# Scenario definitions
declare -a SCENARIOS=(
    "baseline:baseline.test.js:5min"
    "sustained:sustained.test.js:30min"
    "ramp:ramp.test.js:15min"
    "mixed:mixed.test.js:10min"
    "db-stress:db-stress.test.js:10min"
    "stress:stress.test.js:8min"
    "spike:spike.test.js:2min30s"
)

# Run scenarios
echo "═══════════════════════════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
log "Starting test scenarios"
echo "═══════════════════════════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

for scenario in "${SCENARIOS[@]}"; do
    IFS=':' read -r name file duration <<< "$scenario"
    
    # Skip sustained in quick mode or if explicitly skipped
    if [[ "$name" == "sustained" && "$SKIP_SUSTAINED" == "true" ]]; then
        warn "Skipping ${name} (--skip-sustained)"
        SCENARIO_RESULTS[$name]="SKIP"
        ((SKIPPED++))
        continue
    fi
    
    # Skip stress/spike in quick mode
    if [[ "$QUICK_MODE" == "true" && ("$name" == "stress" || "$name" == "spike") ]]; then
        warn "Skipping ${name} (--quick mode)"
        SCENARIO_RESULTS[$name]="SKIP"
        ((SKIPPED++))
        continue
    fi
    
    run_scenario "$name" "$file" "$duration"
done

# Summary
echo "
═══════════════════════════════════════════════════════════════════════════════
                              TEST SUMMARY
═══════════════════════════════════════════════════════════════════════════════
" | tee -a "$LOG_FILE"

for scenario in "${!SCENARIO_RESULTS[@]}"; do
    result="${SCENARIO_RESULTS[$scenario]}"
    case $result in
        PASS) echo -e "  ${GREEN}✓${NC} ${scenario}" | tee -a "$LOG_FILE" ;;
        FAIL) echo -e "  ${RED}✗${NC} ${scenario}" | tee -a "$LOG_FILE" ;;
        SKIP) echo -e "  ${YELLOW}-${NC} ${scenario} (skipped)" | tee -a "$LOG_FILE" ;;
    esac
done

echo "" | tee -a "$LOG_FILE"
echo "  Passed:  ${PASSED}" | tee -a "$LOG_FILE"
echo "  Failed:  ${FAILED}" | tee -a "$LOG_FILE"
echo "  Skipped: ${SKIPPED}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
log "Finished: $(date)"
log "Results saved to: ${RESULTS_DIR}"

echo "
╚══════════════════════════════════════════════════════════════════════════════╝
" | tee -a "$LOG_FILE"

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0
