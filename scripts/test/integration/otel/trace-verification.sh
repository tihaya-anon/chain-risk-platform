#!/bin/bash
# ============================================================
# Integration Test - Cross-Service Trace Verification
# ============================================================
# Verifies distributed tracing by calling BFF API and checking
# that spans from all services appear in Jaeger.
#
# Test Flow:
#   1. Call BFF API endpoint
#   2. Extract trace_id from response header or generate one
#   3. Wait for trace propagation
#   4. Query Jaeger for trace
#   5. Verify spans from expected services
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Configuration
WAIT_SECONDS=${WAIT_SECONDS:-5}
MAX_RETRIES=${MAX_RETRIES:-3}
TEST_ADDRESS="0x28c6c06298d514db089934071355e5743bf21d60"

# Auto-detect host
if curl -s --connect-timeout 2 http://localhost:3001/health > /dev/null 2>&1; then
    HOST="localhost"
else
    HOST="${DOCKER_HOST_IP:-localhost}"
fi

BFF_URL="http://${HOST}:3001"
JAEGER_URL="http://${HOST}:26686"

# Expected services in trace chain
EXPECTED_SERVICES=("bff" "orchestrator" "query-service" "risk-ml-service" "graph-service")
MIN_SERVICES=3

echo "============================================================"
echo "  Integration Test - Cross-Service Trace Verification"
echo "============================================================"
echo ""
echo "Host:         $HOST"
echo "BFF URL:      $BFF_URL"
echo "Jaeger URL:   $JAEGER_URL"
echo "Wait Time:    ${WAIT_SECONDS}s"
echo ""

PASSED=0
FAILED=0
TRACE_ID=""

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

# Prerequisite checks
echo "1. Prerequisite Checks"
echo "──────────────────────"

# Check BFF health
if curl -s --connect-timeout 5 "${BFF_URL}/health" > /dev/null 2>&1; then
    check_pass "BFF is accessible"
else
    check_fail "BFF not accessible at ${BFF_URL}"
    exit 1
fi

# Check Jaeger health
if curl -s --connect-timeout 5 "${JAEGER_URL}/api/services" > /dev/null 2>&1; then
    check_pass "Jaeger is accessible"
else
    check_fail "Jaeger not accessible at ${JAEGER_URL}"
    exit 1
fi

# API call to generate trace
echo ""
echo "2. Generate Cross-Service Trace"
echo "────────────────────────────────"
echo "   Calling: ${BFF_URL}/api/risk/${TEST_ADDRESS}"

# Make API call and capture headers
RESPONSE_FILE=$(mktemp)
HEADER_FILE=$(mktemp)
trap "rm -f $RESPONSE_FILE $HEADER_FILE" EXIT

HTTP_STATUS=$(curl -s -w "%{http_code}" \
    -o "$RESPONSE_FILE" \
    -D "$HEADER_FILE" \
    --connect-timeout 10 \
    --max-time 30 \
    "${BFF_URL}/api/risk/${TEST_ADDRESS}" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "404" ]; then
    check_pass "API call completed (HTTP $HTTP_STATUS)"
else
    check_fail "API call failed (HTTP $HTTP_STATUS)"
    if [ "$HTTP_STATUS" = "000" ]; then
        echo "   Connection failed or timed out"
    fi
    exit 1
fi

# Try to extract trace ID from response header
TRACE_ID=$(grep -i "x-trace-id\|traceparent\|uber-trace-id" "$HEADER_FILE" 2>/dev/null | head -1 | awk '{print $2}' | tr -d '\r' || true)

if [ -n "$TRACE_ID" ]; then
    # Extract trace ID from traceparent format: 00-{trace_id}-{span_id}-{flags}
    if [[ "$TRACE_ID" == 00-* ]]; then
        TRACE_ID=$(echo "$TRACE_ID" | cut -d'-' -f2)
    fi
    check_pass "Extracted trace ID: ${TRACE_ID:0:16}..."
else
    check_warn "No trace ID in response headers (will search by time)"
fi

# Wait for trace propagation
echo ""
echo "3. Waiting for Trace Propagation (${WAIT_SECONDS}s)"
echo "───────────────────────────────────────────────"
sleep "$WAIT_SECONDS"
check_pass "Wait complete"

# Query Jaeger for trace
echo ""
echo "4. Query Jaeger for Traces"
echo "──────────────────────────"

TRACES_FOUND=0
SERVICES_IN_TRACE=()

if [ -n "$TRACE_ID" ]; then
    # Query by trace ID
    echo "   Querying by trace ID..."
    TRACE_DATA=$(curl -s "${JAEGER_URL}/api/traces/${TRACE_ID}" 2>/dev/null || echo "{}")
    
    if echo "$TRACE_DATA" | grep -q '"traceID"'; then
        TRACES_FOUND=1
        SERVICES_IN_TRACE=($(echo "$TRACE_DATA" | grep -o '"serviceName":"[^"]*"' | cut -d'"' -f4 | sort -u))
        check_pass "Found trace by ID"
    else
        check_warn "Trace not found by ID, searching by time..."
    fi
fi

if [ "$TRACES_FOUND" = "0" ]; then
    # Query recent traces from BFF
    echo "   Querying recent BFF traces..."
    RECENT_TRACES=$(curl -s "${JAEGER_URL}/api/traces?service=bff&limit=5&lookback=5m" 2>/dev/null || echo "{}")
    
    TRACE_COUNT=$(echo "$RECENT_TRACES" | grep -o '"traceID"' | wc -l | tr -d ' ')
    
    if [ "$TRACE_COUNT" -gt 0 ] 2>/dev/null; then
        TRACES_FOUND=1
        # Get first trace ID
        FIRST_TRACE_ID=$(echo "$RECENT_TRACES" | grep -o '"traceID":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$FIRST_TRACE_ID" ]; then
            TRACE_DATA=$(curl -s "${JAEGER_URL}/api/traces/${FIRST_TRACE_ID}" 2>/dev/null || echo "{}")
            SERVICES_IN_TRACE=($(echo "$TRACE_DATA" | grep -o '"serviceName":"[^"]*"' | cut -d'"' -f4 | sort -u))
            check_pass "Found $TRACE_COUNT recent trace(s)"
        fi
    else
        check_fail "No traces found in Jaeger"
    fi
fi

# Verify services in trace
echo ""
echo "5. Verify Services in Trace"
echo "───────────────────────────"

if [ ${#SERVICES_IN_TRACE[@]} -gt 0 ]; then
    echo "   Services found in trace:"
    for svc in "${SERVICES_IN_TRACE[@]}"; do
        echo "     - $svc"
    done
    
    SERVICE_COUNT=${#SERVICES_IN_TRACE[@]}
    
    if [ "$SERVICE_COUNT" -ge "$MIN_SERVICES" ]; then
        check_pass "Trace contains $SERVICE_COUNT services (minimum: $MIN_SERVICES)"
    else
        check_fail "Trace only contains $SERVICE_COUNT services (minimum: $MIN_SERVICES)"
    fi
    
    # Check for expected services
    echo ""
    echo "   Expected service coverage:"
    for expected in "${EXPECTED_SERVICES[@]}"; do
        FOUND=0
        for actual in "${SERVICES_IN_TRACE[@]}"; do
            if [ "$expected" = "$actual" ]; then
                FOUND=1
                break
            fi
        done
        
        if [ "$FOUND" = "1" ]; then
            echo -e "     ${GREEN}✓${NC} $expected"
        else
            echo -e "     ${YELLOW}○${NC} $expected (not in this trace)"
        fi
    done
else
    check_fail "No services found in trace"
fi

# Verify span structure (no orphan spans)
echo ""
echo "6. Verify Span Structure"
echo "────────────────────────"

if [ -n "$TRACE_DATA" ] && [ "$TRACE_DATA" != "{}" ]; then
    TOTAL_SPANS=$(echo "$TRACE_DATA" | grep -o '"spanID"' | wc -l | tr -d ' ')
    ROOT_SPANS=$(echo "$TRACE_DATA" | grep -o '"references":\[\]' | wc -l | tr -d ' ')
    
    # Root span check (should have exactly 1)
    if [ -z "$ROOT_SPANS" ] || [ "$ROOT_SPANS" = "0" ]; then
        ROOT_SPANS=$(echo "$TRACE_DATA" | grep -c '"parentSpanId":"0000000000000000"' 2>/dev/null || echo "0")
    fi
    
    if [ "$TOTAL_SPANS" -gt 0 ] 2>/dev/null; then
        check_pass "Total spans: $TOTAL_SPANS"
        
        if [ "$ROOT_SPANS" -eq 1 ] 2>/dev/null; then
            check_pass "Single root span (correct structure)"
        elif [ "$ROOT_SPANS" -gt 1 ] 2>/dev/null; then
            check_warn "Multiple root spans ($ROOT_SPANS) - possible orphan spans"
        else
            check_warn "Could not determine root span count"
        fi
    else
        check_fail "No spans found in trace data"
    fi
else
    check_warn "No trace data to analyze"
fi

# Check registered services in Jaeger
echo ""
echo "7. Jaeger Service Registry"
echo "──────────────────────────"

REGISTERED_SERVICES=$(curl -s "${JAEGER_URL}/api/services" 2>/dev/null | grep -o '"data":\[[^]]*\]' | grep -o '"[^"]*"' | grep -v "data" | tr -d '"' | sort)
REG_COUNT=$(echo "$REGISTERED_SERVICES" | grep -c . || echo "0")

if [ "$REG_COUNT" -gt 0 ] 2>/dev/null; then
    check_pass "Registered services in Jaeger: $REG_COUNT"
    echo "   Services:"
    echo "$REGISTERED_SERVICES" | while read svc; do
        [ -n "$svc" ] && echo "     - $svc"
    done
    
    # Verify Java services are registered
    JAVA_SERVICES_FOUND=0
    if echo "$REGISTERED_SERVICES" | grep -q "graph-service"; then
        JAVA_SERVICES_FOUND=$((JAVA_SERVICES_FOUND + 1))
    fi
    if echo "$REGISTERED_SERVICES" | grep -q "orchestrator"; then
        JAVA_SERVICES_FOUND=$((JAVA_SERVICES_FOUND + 1))
    fi
    
    if [ "$JAVA_SERVICES_FOUND" -eq 2 ]; then
        check_pass "Both Java services registered (graph-service, orchestrator)"
    elif [ "$JAVA_SERVICES_FOUND" -eq 1 ]; then
        check_warn "Only 1 Java service registered"
    else
        check_fail "Java services not registered - OTel agent may not be working"
    fi
else
    check_fail "No services registered in Jaeger"
fi

# Summary
echo ""
echo "============================================================"
echo "  Summary: $PASSED passed, $FAILED failed"
echo "============================================================"

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Integration test failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Ensure all services are running: make services-up"
    echo "  2. Check Java service logs for OTel agent errors"
    echo "  3. Verify Jaeger is receiving traces: make jaeger-trace-test"
    echo "  4. Run smoke test first: make smoke-test"
    exit 1
else
    echo -e "${GREEN}Integration test passed - Cross-service tracing verified${NC}"
    exit 0
fi
