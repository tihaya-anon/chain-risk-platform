#!/bin/bash
# ============================================================
# Jaeger Distributed Tracing Verification
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Auto-detect: if running on Docker host, use localhost
if curl -s --connect-timeout 2 http://localhost:26686/api/services > /dev/null 2>&1; then
    HOST="localhost"
else
    HOST="${DOCKER_HOST_IP:-localhost}"
fi

JAEGER_URL="http://${HOST}:26686"
ES_URL="http://${HOST}:19200"
BFF_URL="http://${HOST}:3001"
ORCHESTRATOR_URL="http://${HOST}:8080"

echo "============================================================"
echo "  Jaeger Distributed Tracing Verification"
echo "============================================================"
echo ""
echo "Host:             $HOST"
echo "Jaeger URL:       $JAEGER_URL"
echo "Elasticsearch:    $ES_URL"
echo ""

PASSED=0
FAILED=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Jaeger API
echo "1. Checking Jaeger API..."
if curl -s "${JAEGER_URL}/api/services" > /dev/null 2>&1; then
    check_pass "Jaeger API accessible"
else
    check_fail "Jaeger API not accessible"
    exit 1
fi

# 2. Check Elasticsearch backend
echo ""
echo "2. Checking Elasticsearch backend..."
ES_HEALTH=$(curl -s "${ES_URL}/_cluster/health" 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ "$ES_HEALTH" = "green" ] || [ "$ES_HEALTH" = "yellow" ]; then
    check_pass "Elasticsearch cluster: $ES_HEALTH"
else
    check_fail "Elasticsearch unhealthy or not accessible"
fi

# 3. Check Jaeger indices in ES
echo ""
echo "3. Checking Jaeger indices..."
JAEGER_INDICES=$(curl -s "${ES_URL}/_cat/indices/jaeger*?h=index" 2>/dev/null | wc -l | tr -d ' ')
if [ "$JAEGER_INDICES" -gt 0 ] 2>/dev/null; then
    check_pass "Found $JAEGER_INDICES Jaeger indices"
    echo "   Indices:"
    curl -s "${ES_URL}/_cat/indices/jaeger*?h=index,docs.count,store.size" 2>/dev/null | while read line; do
        echo "     $line"
    done
else
    check_warn "No Jaeger indices yet (will be created on first trace)"
fi

# 4. Check registered services
echo ""
echo "4. Checking registered services..."
SERVICES=$(curl -s "${JAEGER_URL}/api/services" 2>/dev/null)
SERVICE_COUNT=$(echo "$SERVICES" | grep -o '"data":\[[^]]*\]' | grep -o '"[^"]*"' | grep -v "data" | wc -l | tr -d ' ')
if [ "$SERVICE_COUNT" -gt 0 ] 2>/dev/null; then
    check_pass "Found $SERVICE_COUNT services in Jaeger"
    echo "   Services:"
    echo "$SERVICES" | grep -o '"data":\[[^]]*\]' | grep -o '"[^"]*"' | grep -v "data" | tr -d '"' | while read svc; do
        [ -n "$svc" ] && echo "     - $svc"
    done
else
    check_warn "No services registered yet"
fi

# 5. Check span count
echo ""
echo "5. Checking trace storage..."
SPAN_COUNT=$(curl -s "${ES_URL}/jaeger-span-*/_count" 2>/dev/null | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
if [ -n "$SPAN_COUNT" ] && [ "$SPAN_COUNT" -gt 0 ] 2>/dev/null; then
    check_pass "Stored spans: $SPAN_COUNT"
else
    check_warn "No spans stored yet (run 'make smoke-test' to generate)"
fi

# 6. Generate test trace
echo ""
echo "6. Testing trace generation..."
TEST_RESPONSE=""
if curl -s -o /dev/null -w "%{http_code}" "${BFF_URL}/health" 2>/dev/null | grep -q "200"; then
    echo "   Calling BFF /health..."
    TEST_RESPONSE=$(curl -s "${BFF_URL}/api/health" 2>/dev/null || true)
elif curl -s -o /dev/null -w "%{http_code}" "${ORCHESTRATOR_URL}/actuator/health" 2>/dev/null | grep -q "200"; then
    echo "   Calling Orchestrator /actuator/health..."
    TEST_RESPONSE=$(curl -s "${ORCHESTRATOR_URL}/actuator/health" 2>/dev/null || true)
fi

if [ -n "$TEST_RESPONSE" ]; then
    check_pass "API call completed"
else
    check_warn "No services available to generate test trace"
fi

# 7. Check cross-service traces
echo ""
echo "7. Checking cross-service traces..."
if [ "$SERVICE_COUNT" -gt 1 ] 2>/dev/null; then
    FIRST_SERVICE=$(echo "$SERVICES" | grep -o '"data":\[[^]]*\]' | grep -o '"[^"]*"' | grep -v "data" | tr -d '"' | head -1)
    if [ -n "$FIRST_SERVICE" ]; then
        TRACES=$(curl -s "${JAEGER_URL}/api/traces?service=${FIRST_SERVICE}&limit=5" 2>/dev/null)
        TRACE_COUNT=$(echo "$TRACES" | grep -o '"traceID"' | wc -l | tr -d ' ')
        if [ "$TRACE_COUNT" -gt 0 ] 2>/dev/null; then
            check_pass "Found $TRACE_COUNT recent traces for $FIRST_SERVICE"
        else
            check_warn "No recent traces found"
        fi
    fi
else
    check_warn "Need multiple services to verify cross-service tracing"
fi

# 8. Check ILM policy
echo ""
echo "8. Checking Index Lifecycle Management..."
ILM_POLICY=$(curl -s "${ES_URL}/_ilm/policy/jaeger-traces-policy" 2>/dev/null)
if echo "$ILM_POLICY" | grep -q '"phases"'; then
    check_pass "ILM policy configured"
    DELETE_AGE=$(echo "$ILM_POLICY" | grep -o '"delete":{[^}]*"min_age":"[^"]*"' | grep -o '"min_age":"[^"]*"' | cut -d'"' -f4)
    [ -n "$DELETE_AGE" ] && echo "   Retention: $DELETE_AGE"
else
    check_warn "ILM policy not configured (run 'make jaeger-ilm-setup')"
fi

# Summary
echo ""
echo "============================================================"
echo "  Summary: $PASSED passed, $FAILED failed"
echo "============================================================"

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some checks failed${NC}"
    exit 1
else
    echo -e "${GREEN}Jaeger tracing verification complete${NC}"
fi
