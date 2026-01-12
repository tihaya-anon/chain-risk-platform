#!/bin/bash
# Phase 12 Validation Script
# Validates all SRE & Chaos Engineering deliverables
# Usage: ./scripts/validate-phase12.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    local name=$1
    local condition=$2
    
    if eval "$condition" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
        ((PASS++))
        return 0
    else
        echo -e "  ${RED}✗${NC} $name"
        ((FAIL++))
        return 1
    fi
}

check_warn() {
    local name=$1
    local condition=$2
    
    if eval "$condition" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
        ((PASS++))
        return 0
    else
        echo -e "  ${YELLOW}⚠${NC} $name (optional)"
        ((WARN++))
        return 0
    fi
}

echo "================================================================"
echo "           PHASE 12 VALIDATION - SRE & CHAOS                   "
echo "================================================================"
echo ""

# A1: SLO Definitions
echo "=== A1: SLO/SLI Definitions ==="
check "SLO_DEFINITIONS.md exists" "[ -f '$PROJECT_ROOT/docs/sre/SLO_DEFINITIONS.md' ]"
check "Contains query-service SLO" "grep -q 'query-service.*99.5%' '$PROJECT_ROOT/docs/sre/SLO_DEFINITIONS.md'"
check "Contains PromQL queries" "grep -q 'histogram_quantile' '$PROJECT_ROOT/docs/sre/SLO_DEFINITIONS.md'"
check "Contains error budget formula" "grep -q 'Error Budget' '$PROJECT_ROOT/docs/sre/SLO_DEFINITIONS.md'"
echo ""

# A2: SLO Dashboard
echo "=== A2: SLO Dashboard ==="
check "slo-overview.json exists" "[ -f '$PROJECT_ROOT/infra/grafana/provisioning/dashboards/slo-overview.json' ]"
check "Dashboard has panels" "grep -q '\"panels\"' '$PROJECT_ROOT/infra/grafana/provisioning/dashboards/slo-overview.json'"
check "Dashboard has correct UID" "grep -q '\"uid\": \"slo-overview\"' '$PROJECT_ROOT/infra/grafana/provisioning/dashboards/slo-overview.json'"
check "Alert rules updated" "grep -q 'slo-error-budget' '$PROJECT_ROOT/infra/grafana/provisioning/alerting/rules.yaml'"
check_warn "Dashboard accessible" "curl -sf 'http://localhost:13001/api/dashboards/uid/slo-overview'"
echo ""

# A3: Toxiproxy Setup
echo "=== A3: Toxiproxy Setup ==="
check "chaos.yml exists" "[ -f '$PROJECT_ROOT/infra/compose/chaos.yml' ]"
check "toxiproxy config exists" "[ -f '$PROJECT_ROOT/infra/toxiproxy/config.json' ]"
check "toxiproxy-init.sh exists" "[ -x '$PROJECT_ROOT/scripts/chaos/toxiproxy-init.sh' ]"
check "Config has postgres-proxy" "grep -q 'postgres-proxy' '$PROJECT_ROOT/infra/toxiproxy/config.json'"
check "Config has redis-proxy" "grep -q 'redis-proxy' '$PROJECT_ROOT/infra/toxiproxy/config.json'"
check "Config has kafka-proxy" "grep -q 'kafka-proxy' '$PROJECT_ROOT/infra/toxiproxy/config.json'"
check_warn "Toxiproxy running" "curl -sf 'http://localhost:8474/version'"
echo ""

# A4: Chaos Scenarios
echo "=== A4: Chaos Scenarios ==="
check "common.sh library exists" "[ -f '$PROJECT_ROOT/tests/chaos/lib/common.sh' ]"
check "run-all.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/run-all.sh' ]"
check "db-latency.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/db-latency.sh' ]"
check "db-timeout.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/db-timeout.sh' ]"
check "db-down.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/db-down.sh' ]"
check "redis-down.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/redis-down.sh' ]"
check "kafka-latency.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/kafka-latency.sh' ]"
check "kafka-down.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/kafka-down.sh' ]"
check "network-jitter.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/network-jitter.sh' ]"
check "bandwidth-limit.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/scenarios/bandwidth-limit.sh' ]"
check "CHAOS_SCENARIOS.md exists" "[ -f '$PROJECT_ROOT/docs/sre/CHAOS_SCENARIOS.md' ]"
echo ""

# A5: Recovery Verification
echo "=== A5: Recovery Verification ==="
check "verify-recovery.sh exists" "[ -x '$PROJECT_ROOT/tests/chaos/verify-recovery.sh' ]"
check "Contains TTD check" "grep -q 'TTD' '$PROJECT_ROOT/tests/chaos/verify-recovery.sh'"
check "Contains TTR check" "grep -q 'TTR' '$PROJECT_ROOT/tests/chaos/verify-recovery.sh'"
echo ""

# A6: Circuit Breaker
echo "=== A6: Circuit Breaker ==="
check "query-service CB exists" "[ -f '$PROJECT_ROOT/services/query-service/pkg/circuitbreaker/breaker.go' ]"
check "alert-service CB exists" "[ -f '$PROJECT_ROOT/services/alert-service/pkg/circuitbreaker/breaker.go' ]"
check "CB has metrics" "grep -q 'circuit_breaker_state' '$PROJECT_ROOT/services/query-service/pkg/circuitbreaker/breaker.go'"
check "CB has gobreaker" "grep -q 'sony/gobreaker' '$PROJECT_ROOT/services/query-service/pkg/circuitbreaker/breaker.go'"
check_warn "CB metrics exported" "curl -sf 'http://localhost:8081/metrics' | grep -q 'circuit_breaker'"
echo ""

# A7: Runbooks
echo "=== A7: Runbooks ==="
check "Runbooks README exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/README.md' ]"
check "SERVICE_DOWN.md exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/SERVICE_DOWN.md' ]"
check "DATABASE_FAILURE.md exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/DATABASE_FAILURE.md' ]"
check "HIGH_ERROR_RATE.md exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/HIGH_ERROR_RATE.md' ]"
check "HIGH_LATENCY.md exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/HIGH_LATENCY.md' ]"
check "KAFKA_LAG.md exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/KAFKA_LAG.md' ]"
check "ML_MODEL_FAILURE.md exists" "[ -f '$PROJECT_ROOT/docs/sre/runbooks/ML_MODEL_FAILURE.md' ]"
check "Alerts link to runbooks" "grep -q 'runbook_url' '$PROJECT_ROOT/infra/grafana/provisioning/alerting/rules.yaml'"
echo ""

# Summary
echo "================================================================"
echo "                      VALIDATION SUMMARY                        "
echo "================================================================"
echo ""
echo -e "  ${GREEN}Passed${NC}: $PASS"
echo -e "  ${RED}Failed${NC}: $FAIL"
echo -e "  ${YELLOW}Warnings${NC}: $WARN"
echo ""

TOTAL=$((PASS + FAIL))
PERCENT=$((PASS * 100 / TOTAL))

echo "  Score: ${PERCENT}% ($PASS/$TOTAL)"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ PHASE 12 VALIDATION PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ PHASE 12 VALIDATION FAILED${NC}"
    echo "  Please fix the failed checks above."
    exit 1
fi
