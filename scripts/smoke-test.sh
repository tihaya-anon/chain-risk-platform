#!/bin/bash
# ============================================================
# Smoke Test - Generate traces across all services
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"

# Service URLs
BFF_URL="http://${DOCKER_HOST_IP}:3001"
ORCHESTRATOR_URL="http://${DOCKER_HOST_IP}:8080"
QUERY_URL="http://${DOCKER_HOST_IP}:8081"
RISK_URL="http://${DOCKER_HOST_IP}:8082"
ALERT_URL="http://${DOCKER_HOST_IP}:8083"
GRAPH_URL="http://${DOCKER_HOST_IP}:8084"

# Test address
TEST_ADDRESS="0x28c6c06298d514db089934071355e5743bf21d60"

echo "============================================================"
echo "  Smoke Test - Service Verification & Trace Generation"
echo "============================================================"
echo ""

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name (HTTP $status)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $name (HTTP $status, expected $expected)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Health checks
echo "1. Health Checks"
echo "────────────────"
test_endpoint "BFF /health" "${BFF_URL}/health"
test_endpoint "Orchestrator /actuator/health" "${ORCHESTRATOR_URL}/actuator/health"
test_endpoint "Query Service /health" "${QUERY_URL}/health"
test_endpoint "Risk ML Service /health" "${RISK_URL}/health"
test_endpoint "Alert Service /health" "${ALERT_URL}/health"
test_endpoint "Graph Service /actuator/health" "${GRAPH_URL}/actuator/health"

# API endpoints (via BFF -> Orchestrator -> Backend)
echo ""
echo "2. API Endpoints (Cross-Service Calls)"
echo "───────────────────────────────────────"

# Query service via orchestrator
echo -n "Testing: BFF -> Orchestrator -> Query... "
RESPONSE=$(curl -s -w "\n%{http_code}" "${BFF_URL}/api/address/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Risk service
echo -n "Testing: BFF -> Orchestrator -> Risk... "
RESPONSE=$(curl -s -w "\n%{http_code}" "${BFF_URL}/api/risk/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Graph service
echo -n "Testing: BFF -> Orchestrator -> Graph... "
RESPONSE=$(curl -s -w "\n%{http_code}" "${BFF_URL}/api/graph/neighbors/${TEST_ADDRESS}?depth=1" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Direct service calls
echo ""
echo "3. Direct Service Calls"
echo "───────────────────────"

echo -n "Query Service /api/v1/address... "
RESPONSE=$(curl -s -w "\n%{http_code}" "${QUERY_URL}/api/v1/address/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

echo -n "Risk ML Service /api/v1/risk... "
RESPONSE=$(curl -s -w "\n%{http_code}" "${RISK_URL}/api/v1/risk/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Summary
echo ""
echo "============================================================"
echo "  Summary: $PASSED passed, $FAILED failed"
echo "============================================================"

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}All smoke tests passed${NC}"
    echo ""
    echo "Traces should now be visible in Jaeger:"
    echo "  http://${DOCKER_HOST_IP}:26686"
fi
