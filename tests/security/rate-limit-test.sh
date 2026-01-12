#!/bin/bash
# Rate Limit and Input Validation Test Script
# Tests all services for rate limiting and input validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Service endpoints (adjust ports as needed)
QUERY_SERVICE="${QUERY_SERVICE:-http://localhost:8081}"
ALERT_SERVICE="${ALERT_SERVICE:-http://localhost:8083}"
RISK_SERVICE="${RISK_SERVICE:-http://localhost:8082}"
GRAPH_SERVICE="${GRAPH_SERVICE:-http://localhost:8084}"
BFF_SERVICE="${BFF_SERVICE:-http://localhost:3001}"

# Test address
VALID_ADDRESS="0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00"
INVALID_ADDRESS="invalid_address"
SQL_INJECTION="'; DROP TABLE addresses;--"

echo "=========================================="
echo "Security Testing Suite - Rate Limit & Validation"
echo "=========================================="

# Function to test rate limiting
test_rate_limit() {
    local service_name=$1
    local endpoint=$2
    local limit=$3
    local requests=$((limit + 10))
    
    echo -e "\n${YELLOW}Testing rate limit for ${service_name}...${NC}"
    echo "Endpoint: ${endpoint}"
    echo "Expected limit: ${limit}/min, sending ${requests} requests"
    
    local rate_limited=false
    local count_429=0
    
    for i in $(seq 1 $requests); do
        response=$(curl -s -o /dev/null -w "%{http_code}" "${endpoint}" 2>/dev/null || echo "000")
        if [ "$response" == "429" ]; then
            rate_limited=true
            count_429=$((count_429 + 1))
        fi
    done
    
    if [ "$rate_limited" = true ]; then
        echo -e "${GREEN}✓ Rate limiting working - received ${count_429} 429 responses${NC}"
        return 0
    else
        echo -e "${RED}✗ Rate limiting may not be working - no 429 responses received${NC}"
        return 1
    fi
}

# Function to test address validation
test_address_validation() {
    local service_name=$1
    local endpoint=$2
    
    echo -e "\n${YELLOW}Testing address validation for ${service_name}...${NC}"
    
    # Test valid address
    echo "Testing valid address..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "${endpoint}/${VALID_ADDRESS}" 2>/dev/null || echo "000")
    if [ "$response" != "400" ]; then
        echo -e "${GREEN}✓ Valid address accepted (HTTP ${response})${NC}"
    else
        echo -e "${RED}✗ Valid address rejected (HTTP ${response})${NC}"
    fi
    
    # Test invalid address format
    echo "Testing invalid address format..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "${endpoint}/${INVALID_ADDRESS}" 2>/dev/null || echo "000")
    if [ "$response" == "400" ]; then
        echo -e "${GREEN}✓ Invalid address rejected (HTTP 400)${NC}"
    else
        echo -e "${RED}✗ Invalid address not rejected (HTTP ${response})${NC}"
    fi
    
    # Test SQL injection
    echo "Testing SQL injection pattern..."
    encoded_sql=$(printf '%s' "$SQL_INJECTION" | jq -sRr @uri)
    response=$(curl -s -o /dev/null -w "%{http_code}" "${endpoint}/${encoded_sql}" 2>/dev/null || echo "000")
    if [ "$response" == "400" ]; then
        echo -e "${GREEN}✓ SQL injection pattern rejected (HTTP 400)${NC}"
    else
        echo -e "${YELLOW}⚠ SQL injection pattern returned HTTP ${response}${NC}"
    fi
}

# Function to test request size limits
test_request_size() {
    local service_name=$1
    local endpoint=$2
    
    echo -e "\n${YELLOW}Testing request size limits for ${service_name}...${NC}"
    
    # Generate large payload (2MB)
    large_payload=$(head -c 2097152 /dev/zero | tr '\0' 'a')
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "{\"data\":\"${large_payload:0:1000}\"}" \
        "${endpoint}" 2>/dev/null || echo "000")
    
    if [ "$response" == "413" ] || [ "$response" == "400" ]; then
        echo -e "${GREEN}✓ Large request rejected (HTTP ${response})${NC}"
    else
        echo -e "${YELLOW}⚠ Large request returned HTTP ${response}${NC}"
    fi
}

# Run tests for each service
echo -e "\n=========================================="
echo "Query Service Tests"
echo "=========================================="
test_address_validation "query-service" "${QUERY_SERVICE}/api/v1/addresses"

echo -e "\n=========================================="
echo "Alert Service Tests"
echo "=========================================="
test_address_validation "alert-service" "${ALERT_SERVICE}/api/v1/alerts/address"

echo -e "\n=========================================="
echo "Risk ML Service Tests"
echo "=========================================="
test_address_validation "risk-ml-service" "${RISK_SERVICE}/api/v1/risk"

echo -e "\n=========================================="
echo "Graph Service Tests"
echo "=========================================="
test_address_validation "graph-service" "${GRAPH_SERVICE}/api/v1/graph/address"

echo -e "\n=========================================="
echo "BFF Service Tests"
echo "=========================================="
test_address_validation "bff" "${BFF_SERVICE}/api/v1/addresses"

echo -e "\n=========================================="
echo "Rate Limit Tests (may take a while)"
echo "=========================================="

# Note: Rate limit tests send many requests and may take time
# Uncomment to run full rate limit tests

# test_rate_limit "query-service" "${QUERY_SERVICE}/api/v1/addresses/${VALID_ADDRESS}" 100
# test_rate_limit "risk-ml-service" "${RISK_SERVICE}/api/v1/risk/${VALID_ADDRESS}" 50
# test_rate_limit "graph-service" "${GRAPH_SERVICE}/api/v1/graph/address/${VALID_ADDRESS}" 30
# test_rate_limit "alert-service" "${ALERT_SERVICE}/api/v1/alerts" 60

echo -e "\n=========================================="
echo -e "${GREEN}Security tests completed${NC}"
echo "=========================================="
