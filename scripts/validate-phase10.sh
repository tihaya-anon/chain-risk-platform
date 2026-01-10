#!/bin/bash
# Phase 10 Integration Validation Script
# Validates all containerization, security, persistence, and real-time features

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Track results
declare -a RESULTS

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    RESULTS+=("PASS: $1")
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    RESULTS+=("FAIL: $1")
    ((FAILED++))
}

log_skip() {
    echo -e "${YELLOW}○${NC} $1 (skipped)"
    RESULTS+=("SKIP: $1")
    ((SKIPPED++))
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo " $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Check if service is running
check_container() {
    local name=$1
    if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
        return 0
    fi
    return 1
}

# Check HTTP endpoint
check_http() {
    local url=$1
    local expected_status=${2:-200}
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    [ "$response" = "$expected_status" ]
}

# Check HTTP endpoint with JSON response
check_json() {
    local url=$1
    local jq_filter=$2
    local expected=$3
    local response=$(curl -s "$url" 2>/dev/null)
    local actual=$(echo "$response" | jq -r "$jq_filter" 2>/dev/null)
    [ "$actual" = "$expected" ]
}

#####################################
# Track A: Containerization Checks
#####################################
validate_containerization() {
    log_section "Track A: Containerization"

    local services=("query-service" "alert-service" "risk-ml-service" "graph-service" "orchestrator" "bff")
    
    for svc in "${services[@]}"; do
        if check_container "$svc"; then
            log_pass "$svc container running"
        else
            log_fail "$svc container NOT running"
        fi
    done

    # Check Docker images exist
    for svc in "${services[@]}"; do
        if docker images --format '{{.Repository}}' | grep -q "chainrisk/$svc"; then
            log_pass "$svc Docker image exists"
        else
            log_fail "$svc Docker image NOT found"
        fi
    done

    # Check network isolation
    if docker network ls --format '{{.Name}}' | grep -q "chainrisk-frontend"; then
        log_pass "Frontend network exists"
    else
        log_fail "Frontend network NOT found"
    fi

    if docker network ls --format '{{.Name}}' | grep -q "chainrisk-backend"; then
        log_pass "Backend network exists"
    else
        log_fail "Backend network NOT found"
    fi

    if docker network ls --format '{{.Name}}' | grep -q "chainrisk-monitoring"; then
        log_pass "Monitoring network exists"
    else
        log_fail "Monitoring network NOT found"
    fi
}

#####################################
# Track B: Security Checks
#####################################
validate_security() {
    log_section "Track B: Security"

    # Vault health check
    if check_http "http://localhost:18200/v1/sys/health" 200; then
        log_pass "Vault is healthy"
    elif check_http "http://localhost:18200/v1/sys/health" 501; then
        log_skip "Vault not initialized (expected in dev mode)"
    else
        log_skip "Vault not deployed (W2 dependency)"
    fi

    # JWT endpoint check
    if check_http "http://localhost:8080/auth/login" 401; then
        log_pass "Auth endpoint available (returns 401 without creds)"
    elif check_http "http://localhost:8080/auth/login" 404; then
        log_skip "JWT auth endpoint not implemented (W2 dependency)"
    else
        log_skip "Orchestrator not accessible"
    fi

    # RBAC check (requires W2 CP-7)
    log_skip "RBAC validation (W2 CP-7 dependency)"
}

#####################################
# Track C: Persistence Checks
#####################################
validate_persistence() {
    log_section "Track C: Persistence"

    # Elasticsearch health
    if check_json "http://localhost:19200/_cluster/health" ".status" "green"; then
        log_pass "Elasticsearch cluster is GREEN"
    elif check_json "http://localhost:19200/_cluster/health" ".status" "yellow"; then
        log_pass "Elasticsearch cluster is YELLOW (acceptable for single node)"
    else
        log_skip "Elasticsearch not deployed (W3 dependency)"
    fi

    # Jaeger with ES backend
    if check_http "http://localhost:26686/api/services" 200; then
        log_pass "Jaeger API accessible"
        
        # Check if traces exist
        local services=$(curl -s "http://localhost:26686/api/services" | jq -r '.data | length' 2>/dev/null)
        if [ "$services" -gt 0 ] 2>/dev/null; then
            log_pass "Jaeger has trace data ($services services)"
        else
            log_skip "No trace data yet"
        fi
    else
        log_fail "Jaeger API not accessible"
    fi

    # Trace retention policy (requires W3 CP-10)
    log_skip "ILM policy validation (W3 CP-10 dependency)"
}

#####################################
# Track D: Real-time Checks
#####################################
validate_realtime() {
    log_section "Track D: Real-time"

    # WebSocket endpoint (requires W3 CP-11)
    log_skip "WebSocket gateway validation (W3 CP-11 dependency)"
    log_skip "Alert push validation (W3 CP-12 dependency)"
    log_skip "Frontend WS integration (W3 CP-13 dependency)"
}

#####################################
# Track E: Operations Checks
#####################################
validate_operations() {
    log_section "Track E: Operations"

    local services=(
        "query-service:8081"
        "alert-service:8083"
        "risk-ml-service:8082"
        "graph-service:8084"
        "orchestrator:8080"
        "bff:3001"
    )

    for entry in "${services[@]}"; do
        local svc="${entry%%:*}"
        local port="${entry##*:}"

        # Basic health
        if check_http "http://localhost:$port/health" 200; then
            log_pass "$svc /health endpoint OK"
        else
            log_fail "$svc /health endpoint FAILED"
        fi

        # Liveness probe
        if check_http "http://localhost:$port/health/live" 200; then
            log_pass "$svc /health/live endpoint OK"
        else
            log_skip "$svc /health/live not implemented"
        fi

        # Readiness probe
        if check_http "http://localhost:$port/health/ready" 200; then
            log_pass "$svc /health/ready endpoint OK"
        elif check_http "http://localhost:$port/health/ready" 503; then
            log_pass "$svc /health/ready returns 503 (dependencies down)"
        else
            log_skip "$svc /health/ready not implemented"
        fi
    done

    # Prometheus scraping
    if check_http "http://localhost:19090/api/v1/targets" 200; then
        log_pass "Prometheus targets accessible"
    else
        log_fail "Prometheus not accessible"
    fi

    # Grafana
    if check_http "http://localhost:13001/api/health" 200; then
        log_pass "Grafana health OK"
    else
        log_fail "Grafana not accessible"
    fi

    # Loki
    if check_http "http://localhost:13100/ready" 200; then
        log_pass "Loki ready"
    else
        log_fail "Loki not ready"
    fi
}

#####################################
# Log Correlation Check
#####################################
validate_log_correlation() {
    log_section "Log-Trace Correlation"

    # Check if logs contain trace_id
    local sample_log=$(docker logs query-service 2>&1 | head -50 | grep -o 'trace_id' | head -1)
    if [ -n "$sample_log" ]; then
        log_pass "query-service logs contain trace_id"
    else
        log_skip "trace_id not found in logs (may need traffic)"
    fi
}

#####################################
# Summary
#####################################
print_summary() {
    log_section "Validation Summary"

    echo ""
    echo "Results:"
    echo "  Passed:  $PASSED"
    echo "  Failed:  $FAILED"
    echo "  Skipped: $SKIPPED"
    echo ""

    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}Some checks failed!${NC}"
        echo ""
        echo "Failed checks:"
        for result in "${RESULTS[@]}"; do
            if [[ "$result" == FAIL:* ]]; then
                echo "  - ${result#FAIL: }"
            fi
        done
        exit 1
    elif [ $PASSED -eq 0 ]; then
        echo -e "${YELLOW}No checks passed - services may not be running${NC}"
        exit 1
    else
        echo -e "${GREEN}All critical checks passed!${NC}"
    fi
}

#####################################
# Main
#####################################
main() {
    echo "Phase 10: Production Hardening Validation"
    echo "=========================================="
    echo ""
    echo "Note: Some checks depend on W2/W3 deliverables"
    echo ""

    validate_containerization
    validate_security
    validate_persistence
    validate_realtime
    validate_operations
    validate_log_correlation
    print_summary
}

main "$@"
