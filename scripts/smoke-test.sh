#!/bin/bash
# ============================================================
# Smoke Test - Generate traces across all services
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Auto-detect: if running on the Docker host, use localhost
# Check if we can reach localhost:3001 (BFF), if yes use localhost
if curl -s --connect-timeout 2 http://localhost:3001/health > /dev/null 2>&1; then
    HOST="localhost"
else
    HOST="${DOCKER_HOST_IP:-localhost}"
fi

# Service URLs
BFF_URL="http://${HOST}:3001"
ORCHESTRATOR_URL="http://${HOST}:8080"
QUERY_URL="http://${HOST}:8081"
RISK_URL="http://${HOST}:8082"
ALERT_URL="http://${HOST}:8083"
GRAPH_URL="http://${HOST}:8084"

# Test address
TEST_ADDRESS="0x28c6c06298d514db089934071355e5743bf21d60"

echo "============================================================"
echo "  Smoke Test - Service Verification & Trace Generation"
echo "============================================================"
echo ""
echo "Host: $HOST"
echo ""

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")
    
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
test_endpoint "BFF /health" "${BFF_URL}/health" || true
test_endpoint "Orchestrator /actuator/health" "${ORCHESTRATOR_URL}/actuator/health" || true
test_endpoint "Query Service /health" "${QUERY_URL}/health" || true
test_endpoint "Risk ML Service /health" "${RISK_URL}/health" || true
test_endpoint "Alert Service /health" "${ALERT_URL}/health" || true
test_endpoint "Graph Service /actuator/health" "${GRAPH_URL}/actuator/health" || true

# API endpoints (via BFF -> Orchestrator -> Backend)
echo ""
echo "2. Cross-Service API Calls"
echo "──────────────────────────"

# Query service via BFF
echo -n "BFF -> Orchestrator -> Query... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${BFF_URL}/api/address/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Risk service via BFF
echo -n "BFF -> Orchestrator -> Risk... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${BFF_URL}/api/risk/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Graph service via BFF
echo -n "BFF -> Orchestrator -> Graph... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${BFF_URL}/api/graph/neighbors/${TEST_ADDRESS}?depth=1" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Direct service calls
echo ""
echo "3. Direct Service Calls"
echo "───────────────────────"

echo -n "Query /api/v1/address... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${QUERY_URL}/api/v1/address/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

echo -n "Risk /api/v1/risk... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${RISK_URL}/api/v1/risk/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
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
    echo -e "${GREEN}All smoke tests passed - traces generated${NC}"
fi
