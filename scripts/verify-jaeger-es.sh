#!/bin/bash
# ============================================================
# Verify Jaeger traces persist in Elasticsearch
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
ES_URL="http://${DOCKER_HOST_IP}:19200"
JAEGER_URL="http://${DOCKER_HOST_IP}:26686"

echo "============================================"
echo "  Jaeger Elasticsearch Backend Verification"
echo "============================================"

# Check ES health
echo -e "\n1. Checking Elasticsearch health..."
ES_HEALTH=$(curl -s "${ES_URL}/_cluster/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$ES_HEALTH" = "green" ] || [ "$ES_HEALTH" = "yellow" ]; then
    echo -e "   ${GREEN}✓ ES Status: $ES_HEALTH${NC}"
else
    echo -e "   ${RED}✗ ES unhealthy${NC}"
    exit 1
fi

# Check Jaeger indices
echo -e "\n2. Checking Jaeger indices in ES..."
INDICES=$(curl -s "${ES_URL}/_cat/indices/jaeger*?h=index" 2>/dev/null)
if [ -n "$INDICES" ]; then
    echo -e "   ${GREEN}✓ Found indices:${NC}"
    echo "$INDICES" | while read idx; do
        echo "     - $idx"
    done
else
    echo -e "   ${YELLOW}⚠ No Jaeger indices yet (will be created on first trace)${NC}"
fi

# Check Jaeger services
echo -e "\n3. Checking Jaeger services..."
SERVICES=$(curl -s "${JAEGER_URL}/api/services" 2>/dev/null | grep -o '"data":\[[^]]*\]' | grep -o '"[^"]*"' | grep -v "data" | tr -d '"' | head -5)
if [ -n "$SERVICES" ]; then
    echo -e "   ${GREEN}✓ Services found:${NC}"
    echo "$SERVICES" | while read svc; do
        [ -n "$svc" ] && echo "     - $svc"
    done
else
    echo -e "   ${YELLOW}⚠ No services yet (send some traces first)${NC}"
fi

# Check trace count
echo -e "\n4. Checking trace storage..."
SPAN_COUNT=$(curl -s "${ES_URL}/jaeger-span-*/_count" 2>/dev/null | grep -o '"count":[0-9]*' | cut -d':' -f2)
if [ -n "$SPAN_COUNT" ] && [ "$SPAN_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✓ Stored spans: $SPAN_COUNT${NC}"
else
    echo -e "   ${YELLOW}⚠ No spans stored yet${NC}"
fi

echo -e "\n============================================"
echo "Jaeger UI:       ${JAEGER_URL}"
echo "ES Indices:      ${ES_URL}/_cat/indices/jaeger*?v"
echo "============================================"
