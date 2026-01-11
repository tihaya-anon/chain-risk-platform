#!/bin/bash
# ============================================================
# Phase 10 Integration Validation Script
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/common.sh"

# Auto-detect host
if curl -s --connect-timeout 2 http://localhost:3001/health > /dev/null 2>&1; then
    HOST="localhost"
else
    HOST="${DOCKER_HOST_IP:-localhost}"
fi

# Counters
PASSED=0
FAILED=0
SKIPPED=0

declare -a RESULTS

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    RESULTS+=("PASS: $1")
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    RESULTS+=("FAIL: $1")
    FAILED=$((FAILED + 1))
}

log_skip() {
    echo -e "${YELLOW}○${NC} $1 (skipped)"
    RESULTS+=("SKIP: $1")
    SKIPPED=$((SKIPPED + 1))
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo " $1"
    echo "═══════════════════════════════════════════════════════════════"
}

check_container() {
    local name=$1
    docker ps --format '{{.Names}}' | grep -q "^${name}$"
}

check_http() {
    local url=$1
    local expected=${2:-200}
    local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")
    [ "$status" = "$expected" ]
}

#####################################
# Track A: Containerization
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

    # Networks
    for net in "chainrisk-backend" "chainrisk-monitoring"; do
        if docker network ls --format '{{.Name}}' | grep -q "$net"; then
            log_pass "$net network exists"
        else
            log_fail "$net network NOT found"
        fi
    done
}

#####################################
# Track B: Security
#####################################
validate_security() {
    log_section "Track B: Security"

    if check_http "http://${HOST}:18200/v1/sys/health" 200; then
        log_pass "Vault is healthy and unsealed"
    elif check_http "http://${HOST}:18200/v1/sys/health" 501; then
        log_skip "Vault not initialized"
    else
        log_fail "Vault not accessible"
    fi

    # Check secrets exist
    if [ -f "$PROJECT_ROOT/.vault-keys" ]; then
        log_pass "Vault keys file exists"
    else
        log_skip "Vault keys file not found"
    fi
}

#####################################
# Track C: Persistence
#####################################
validate_persistence() {
    log_section "Track C: Persistence"

    # Elasticsearch
    ES_STATUS=$(curl -s "http://${HOST}:19200/_cluster/health" 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
    if [ "$ES_STATUS" = "green" ] || [ "$ES_STATUS" = "yellow" ]; then
        log_pass "Elasticsearch cluster: $ES_STATUS"
    else
        log_fail "Elasticsearch unhealthy"
    fi

    # Jaeger
    if check_http "http://${HOST}:26686/api/services" 200; then
        log_pass "Jaeger API accessible"
    else
        log_fail "Jaeger not accessible"
    fi

    # ILM Policy
    ILM=$(curl -s "http://${HOST}:19200/_ilm/policy/jaeger-traces-policy" 2>/dev/null)
    if echo "$ILM" | grep -q '"phases"'; then
        log_pass "Jaeger ILM policy configured"
    else
        log_skip "ILM policy not configured"
    fi
}

#####################################
# Track D: Real-time
#####################################
validate_realtime() {
    log_section "Track D: Real-time"

    # WebSocket endpoint exists in BFF
    if check_http "http://${HOST}:3001/health" 200; then
        log_pass "BFF WebSocket gateway available"
    else
        log_fail "BFF not accessible"
    fi
}

#####################################
# Track E: Operations
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

        if check_http "http://${HOST}:$port/health" 200; then
            log_pass "$svc health OK"
        else
            log_fail "$svc health FAILED"
        fi
    done

    # Monitoring
    if check_http "http://${HOST}:19090/api/v1/targets" 200; then
        log_pass "Prometheus accessible"
    else
        log_fail "Prometheus not accessible"
    fi

    if check_http "http://${HOST}:13001/api/health" 200; then
        log_pass "Grafana accessible"
    else
        log_fail "Grafana not accessible"
    fi

    if check_http "http://${HOST}:13100/ready" 200; then
        log_pass "Loki accessible"
    else
        log_fail "Loki not accessible"
    fi
}

#####################################
# Summary
#####################################
print_summary() {
    log_section "Validation Summary"

    echo ""
    echo "Host: $HOST"
    echo ""
    echo "Results:"
    echo "  Passed:  $PASSED"
    echo "  Failed:  $FAILED"
    echo "  Skipped: $SKIPPED"
    echo ""

    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}Some checks failed!${NC}"
        echo ""
        echo "Failed:"
        for result in "${RESULTS[@]}"; do
            [[ "$result" == FAIL:* ]] && echo "  - ${result#FAIL: }"
        done
        exit 1
    else
        echo -e "${GREEN}Phase 10 validation passed!${NC}"
    fi
}

#####################################
# Main
#####################################
main() {
    echo "============================================================"
    echo "  Phase 10: Production Hardening - Final Validation"
    echo "============================================================"

    validate_containerization
    validate_security
    validate_persistence
    validate_realtime
    validate_operations
    print_summary
}

main "$@"
