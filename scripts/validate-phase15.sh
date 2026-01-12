#!/bin/bash
# Phase 15 Performance Testing Validation
# Owner: Worker C (Phase 15)
#
# Validates all Phase 15 deliverables are complete
# Usage: ./validate-phase15.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

check() {
    local description=$1
    local condition=$2
    
    if eval "$condition"; then
        echo -e "${GREEN}✓${NC} ${description}"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} ${description}"
        ((FAILED++))
    fi
}

echo "
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PHASE 15 VALIDATION                                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
"

echo "Checking from: ${PROJECT_ROOT}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# C1: New Test Scenarios
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "C1: Scenario Scripts"
echo "═══════════════════════════════════════════════════════════════════════════════"

check "sustained.test.js exists" \
    "[ -f '${PROJECT_ROOT}/tests/api/performance/sustained.test.js' ]"

check "ramp.test.js exists" \
    "[ -f '${PROJECT_ROOT}/tests/api/performance/ramp.test.js' ]"

check "mixed.test.js exists" \
    "[ -f '${PROJECT_ROOT}/tests/api/performance/mixed.test.js' ]"

check "db-stress.test.js exists" \
    "[ -f '${PROJECT_ROOT}/tests/api/performance/db-stress.test.js' ]"

check "run-all.sh exists and executable" \
    "[ -x '${PROJECT_ROOT}/tests/api/performance/run-all.sh' ]"

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# C2: Test Results
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "C2: Test Execution Results"
echo "═══════════════════════════════════════════════════════════════════════════════"

check "Results directory exists" \
    "[ -d '${PROJECT_ROOT}/tests/api/performance/results' ]"

# Check for result files
for scenario in baseline sustained ramp mixed db-stress; do
    check "${scenario} results exist" \
        "[ -f '${PROJECT_ROOT}/tests/api/performance/results/${scenario}-summary.json' ]"
done

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# C3: Documentation
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "C3: Analysis & Report"
echo "═══════════════════════════════════════════════════════════════════════════════"

check "Baseline report exists" \
    "[ -f '${PROJECT_ROOT}/docs/performance/BASELINE_REPORT.md' ]"

check "Analysis script exists" \
    "[ -f '${PROJECT_ROOT}/scripts/analyze-perf-results.sh' ]"

check "Validation script exists" \
    "[ -f '${PROJECT_ROOT}/scripts/validate-phase15.sh' ]"

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# SLA Compliance Check
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "SLA Compliance"
echo "═══════════════════════════════════════════════════════════════════════════════"

if command -v jq &> /dev/null; then
    BASELINE_RESULTS="${PROJECT_ROOT}/tests/api/performance/results/baseline-summary.json"
    if [ -f "$BASELINE_RESULTS" ]; then
        P95=$(jq -r '.metrics.http_req_duration.values["p(95)"] // 999999' "$BASELINE_RESULTS")
        ERROR_RATE=$(jq -r '(.metrics.http_req_failed.values.rate // 0) * 100' "$BASELINE_RESULTS")
        
        check "Baseline P95 < 500ms (actual: ${P95%.*}ms)" \
            "[ \$(echo '$P95 < 500' | bc -l) -eq 1 ]"
        
        check "Error rate < 1% (actual: ${ERROR_RATE%.*}%)" \
            "[ \$(echo '$ERROR_RATE < 1' | bc -l) -eq 1 ]"
    else
        echo -e "${YELLOW}!${NC} Baseline results not found - run tests first"
    fi
else
    echo -e "${YELLOW}!${NC} jq not installed - skipping SLA checks"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Passed: ${PASSED}"
echo "  Failed: ${FAILED}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Phase 15 validation PASSED${NC}"
    echo "
╚══════════════════════════════════════════════════════════════════════════════╝
"
    exit 0
else
    echo -e "${RED}Phase 15 validation FAILED${NC}"
    echo ""
    echo "Please complete the missing items before proceeding."
    echo "
╚══════════════════════════════════════════════════════════════════════════════╝
"
    exit 1
fi
