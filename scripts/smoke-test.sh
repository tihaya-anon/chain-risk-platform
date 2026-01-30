#!/bin/bash
# ============================================================
# Smoke Test - Generate traces across all services
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Get Docker host IP from environment
HOST="${DOCKER_HOST_IP:-localhost}"

# Service URLs with mapped external ports
BFF_URL="http://${HOST}:3401"
QUERY_URL="http://${HOST}:18081"
RISK_URL="http://${HOST}:8082"
ALERT_URL="http://${HOST}:18083"
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
test_endpoint "Query Service /health" "${QUERY_URL}/health" || true
test_endpoint "Risk ML Service /health" "${RISK_URL}/health" || true
test_endpoint "Alert Service /health" "${ALERT_URL}/health" || true
test_endpoint "Graph Service /actuator/health" "${GRAPH_URL}/actuator/health" || true

# API endpoints (via BFF -> Backend)
echo ""
echo "2. Cross-Service API Calls (via BFF)"
echo "─────────────────────────────────────"

# Query service via BFF
echo -n "BFF -> Query... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${BFF_URL}/api/v1/addresses/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
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
echo -n "BFF -> Risk... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 -X POST -H "Content-Type: application/json" -d "{\"address\":\"${TEST_ADDRESS}\"}" "${BFF_URL}/api/v1/risk/score" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

# Graph service via BFF
echo -n "BFF -> Graph... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${BFF_URL}/api/v1/graph/address/${TEST_ADDRESS}/neighbors?depth=1" 2>/dev/null || echo -e "\n000")
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

echo -n "Query /api/v1/addresses... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${QUERY_URL}/api/v1/addresses/${TEST_ADDRESS}" 2>/dev/null || echo -e "\n000")
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

echo -n "Risk /api/v1/risk/score... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 -X POST -H "Content-Type: application/json" -d "{\"address\":\"${TEST_ADDRESS}\"}" "${RISK_URL}/api/v1/risk/score" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ] || [ "$STATUS" = "404" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

echo -n "Alert /api/v1/alerts/rules... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${ALERT_URL}/api/v1/alerts/rules" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
    PASSED=$((PASSED + 1))
elif [ "$STATUS" = "000" ]; then
    echo -e "${RED}✗${NC} (connection failed)"
    FAILED=$((FAILED + 1))
else
    echo -e "${YELLOW}⚠${NC} (HTTP $STATUS)"
fi

echo -n "Graph /actuator/health... "
RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${GRAPH_URL}/actuator/health" 2>/dev/null || echo -e "\n000")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
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
    echo -e "${GREEN}All smoke tests passed${NC}"
fi
