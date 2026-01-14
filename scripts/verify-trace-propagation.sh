#!/usr/bin/env bash
# Trace Propagation Verification Script
# Verifies W3C Trace Context propagation across all services

set -euo pipefail

JAEGER_URL="${JAEGER_URL:-http://localhost:26686}"
BFF_URL="${BFF_URL:-http://localhost:3001}"

echo "=========================================="
echo "Trace Propagation Verification"
echo "=========================================="

# Generate a unique trace for testing
TEST_ADDRESS="0x28c6c06298d514db089934071355e5743bf21d60"
TRACE_ID=$(openssl rand -hex 16)
SPAN_ID=$(openssl rand -hex 8)
TRACEPARENT="00-${TRACE_ID}-${SPAN_ID}-01"

echo "Test Trace ID: ${TRACE_ID}"
echo "Traceparent: ${TRACEPARENT}"
echo ""

# Send request with traceparent header
echo "Sending request to BFF orchestration endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "traceparent: ${TRACEPARENT}" \
    -H "Content-Type: application/json" \
    "${BFF_URL}/api/v1/orchestration/address-profile/${TEST_ADDRESS}" \
    2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ Request succeeded (HTTP ${HTTP_STATUS})"
else
    echo "✗ Request failed (HTTP ${HTTP_STATUS})"
fi

# Wait for traces to be indexed
echo ""
echo "Waiting 5s for traces to be indexed..."
sleep 5

# Query Jaeger for the trace
echo ""
echo "Querying Jaeger for trace ${TRACE_ID}..."

TRACE_RESPONSE=$(curl -s "${JAEGER_URL}/api/traces/${TRACE_ID}" 2>/dev/null || echo "{}")

if [ "$TRACE_RESPONSE" = "{}" ] || [ -z "$TRACE_RESPONSE" ]; then
    echo "✗ Trace not found in Jaeger"
    echo "  This may indicate:"
    echo "  - Trace propagation is not working"
    echo "  - Jaeger is not receiving spans"
    echo "  - Traces are not being exported"
    exit 1
fi

# Parse services from trace
SERVICES=$(echo "$TRACE_RESPONSE" | jq -r '.data[0].spans[].processID' 2>/dev/null | sort -u | wc -l)
SPAN_COUNT=$(echo "$TRACE_RESPONSE" | jq -r '.data[0].spans | length' 2>/dev/null)

echo "✓ Trace found in Jaeger"
echo "  Spans: ${SPAN_COUNT}"
echo "  Services: ${SERVICES}"

# Check for expected services
echo ""
echo "Checking service participation..."

EXPECTED_SERVICES=("bff" "query-service" "risk-ml-service")
FOUND_SERVICES=$(echo "$TRACE_RESPONSE" | jq -r '.data[0].processes | to_entries[].value.serviceName' 2>/dev/null)

for svc in "${EXPECTED_SERVICES[@]}"; do
    if echo "$FOUND_SERVICES" | grep -q "$svc"; then
        echo "✓ ${svc} participated in trace"
    else
        echo "✗ ${svc} NOT found in trace"
    fi
done

# Check parent-child relationships
echo ""
echo "Checking span hierarchy..."

ROOT_SPANS=$(echo "$TRACE_RESPONSE" | jq -r '[.data[0].spans[] | select(.references | length == 0)] | length' 2>/dev/null)
CHILD_SPANS=$(echo "$TRACE_RESPONSE" | jq -r '[.data[0].spans[] | select(.references | length > 0)] | length' 2>/dev/null)

echo "Root spans: ${ROOT_SPANS}"
echo "Child spans: ${CHILD_SPANS}"

if [ "$ROOT_SPANS" = "1" ]; then
    echo "✓ Single root span (correct propagation)"
else
    echo "⚠ Multiple root spans (${ROOT_SPANS}) - may indicate broken propagation"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="

if [ "$SERVICES" -ge 2 ] && [ "$ROOT_SPANS" = "1" ]; then
    echo "✓ Trace propagation appears to be working correctly"
    echo "  - Traces flow across ${SERVICES} services"
    echo "  - Parent-child relationships are maintained"
    exit 0
else
    echo "⚠ Trace propagation may have issues"
    echo "  Review Jaeger UI: ${JAEGER_URL}/trace/${TRACE_ID}"
    exit 1
fi
