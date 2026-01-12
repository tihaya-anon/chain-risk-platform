#!/bin/bash
# Performance Results Analyzer
# Owner: Worker C (Phase 15)
#
# Analyzes k6 test results and generates summary
# Usage: ./analyze-perf-results.sh [results_dir]

RESULTS_DIR="${1:-tests/api/performance/results}"
OUTPUT_FILE="${RESULTS_DIR}/analysis-summary.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# SLA Definitions
declare -A SLA_P95
SLA_P95["baseline"]=500
SLA_P95["sustained"]=500
SLA_P95["ramp"]=800
SLA_P95["mixed-read"]=300
SLA_P95["mixed-write"]=500
SLA_P95["db-stress-simple"]=200
SLA_P95["db-stress-complex"]=1000
SLA_P95["db-stress-aggregation"]=2000
SLA_P95["stress"]=1000
SLA_P95["spike"]=1500

echo "
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PERFORMANCE ANALYSIS REPORT                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
" | tee "$OUTPUT_FILE"

echo "Analysis Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Results Directory: ${RESULTS_DIR}" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required. Install with: brew install jq${NC}"
    exit 1
fi

# Check if results exist
if [ ! -d "$RESULTS_DIR" ]; then
    echo -e "${RED}Error: Results directory not found: ${RESULTS_DIR}${NC}"
    exit 1
fi

echo "═══════════════════════════════════════════════════════════════════════════════" | tee -a "$OUTPUT_FILE"
echo "                          SCENARIO RESULTS                                      " | tee -a "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════════════════════" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Analyze each summary file
for file in "$RESULTS_DIR"/*-summary.json; do
    if [ ! -f "$file" ]; then
        continue
    fi
    
    name=$(basename "$file" -summary.json)
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$OUTPUT_FILE"
    echo -e "${BLUE}${name^^}${NC}" | tee -a "$OUTPUT_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$OUTPUT_FILE"
    
    # Extract metrics
    requests=$(jq -r '.metrics.http_reqs.values.count // "N/A"' "$file")
    rps=$(jq -r '.metrics.http_reqs.values.rate // 0 | floor' "$file")
    p50=$(jq -r '.metrics.http_req_duration.values["p(50)"] // "N/A" | if type == "number" then floor else . end' "$file")
    p95=$(jq -r '.metrics.http_req_duration.values["p(95)"] // "N/A" | if type == "number" then floor else . end' "$file")
    p99=$(jq -r '.metrics.http_req_duration.values["p(99)"] // "N/A" | if type == "number" then floor else . end' "$file")
    error_rate=$(jq -r '(.metrics.http_req_failed.values.rate // 0) * 100 | floor' "$file")
    
    # Check SLA
    sla="${SLA_P95[$name]:-500}"
    if [ "$p95" != "N/A" ] && [ "$p95" -le "$sla" ]; then
        status="${GREEN}✓ PASS${NC}"
    else
        status="${RED}✗ FAIL${NC}"
    fi
    
    echo "  Requests:      ${requests}" | tee -a "$OUTPUT_FILE"
    echo "  RPS:           ${rps}" | tee -a "$OUTPUT_FILE"
    echo "  P50:           ${p50}ms" | tee -a "$OUTPUT_FILE"
    echo "  P95:           ${p95}ms (SLA: <${sla}ms)" | tee -a "$OUTPUT_FILE"
    echo "  P99:           ${p99}ms" | tee -a "$OUTPUT_FILE"
    echo "  Errors:        ${error_rate}%" | tee -a "$OUTPUT_FILE"
    echo -e "  Status:        ${status}" | tee -a "$OUTPUT_FILE"
    echo "" | tee -a "$OUTPUT_FILE"
done

# Overall Summary
echo "═══════════════════════════════════════════════════════════════════════════════" | tee -a "$OUTPUT_FILE"
echo "                          OVERALL SUMMARY                                       " | tee -a "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════════════════════" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Count results
total_files=$(find "$RESULTS_DIR" -name "*-summary.json" | wc -l | tr -d ' ')
passed=0
failed=0

for file in "$RESULTS_DIR"/*-summary.json; do
    if [ ! -f "$file" ]; then
        continue
    fi
    
    name=$(basename "$file" -summary.json)
    sla="${SLA_P95[$name]:-500}"
    p95=$(jq -r '.metrics.http_req_duration.values["p(95)"] // 999999 | floor' "$file")
    
    if [ "$p95" -le "$sla" ]; then
        ((passed++))
    else
        ((failed++))
    fi
done

echo "  Total Scenarios: ${total_files}" | tee -a "$OUTPUT_FILE"
echo -e "  Passed:         ${GREEN}${passed}${NC}" | tee -a "$OUTPUT_FILE"
echo -e "  Failed:         ${RED}${failed}${NC}" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

if [ $failed -eq 0 ]; then
    echo -e "  ${GREEN}All performance tests passed!${NC}" | tee -a "$OUTPUT_FILE"
else
    echo -e "  ${RED}Some performance tests failed. Review results for details.${NC}" | tee -a "$OUTPUT_FILE"
fi

echo "
╚══════════════════════════════════════════════════════════════════════════════╝
" | tee -a "$OUTPUT_FILE"

echo "Analysis saved to: ${OUTPUT_FILE}"
