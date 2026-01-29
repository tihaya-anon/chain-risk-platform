#!/bin/bash
# Docker Build Test Script
# Phase 19 - Checkpoint A1

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "======================================"
echo "Docker Build Test"
echo "Phase 19 - Checkpoint A1"
echo "======================================"
echo ""

# Track results
TOTAL=0
SUCCESS=0
FAILED=0

# Function to test build
test_build() {
    local service=$1
    local dir=$2

    TOTAL=$((TOTAL + 1))

    echo -e "${BLUE}[$TOTAL]${NC} Testing $service..."
    echo "  Directory: $dir"
    echo -n "  Building... "

    if docker build -t chainrisk/$service:test $dir > /tmp/docker-build-$service.log 2>&1; then
        echo -e "${GREEN}✓ SUCCESS${NC}"
        SUCCESS=$((SUCCESS + 1))

        # Get image size
        SIZE=$(docker images chainrisk/$service:test --format "{{.Size}}")
        echo "  Image size: $SIZE"

        # Clean up test image
        docker rmi chainrisk/$service:test > /dev/null 2>&1
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        FAILED=$((FAILED + 1))
        echo "  Log: /tmp/docker-build-$service.log"
        echo "  Error preview:"
        tail -10 /tmp/docker-build-$service.log | sed 's/^/    /'
        return 1
    fi
    echo ""
}

echo "Testing Service Builds"
echo "======================"
echo ""

# Test each service
test_build "query-service" "services/query-service"
test_build "alert-service" "services/alert-service"
test_build "risk-ml-service" "services/risk-ml-service"
test_build "graph-service" "services/graph-service"
test_build "bff" "services/bff"
test_build "mempool-collector" "mempool-collector"

echo ""
echo "======================================"
echo "Summary"
echo "======================================"
echo "Total:   $TOTAL"
echo -e "Success: ${GREEN}$SUCCESS${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All builds passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: make docker-build (to build with proper tags)"
    echo "  2. Run: make infra-up"
    echo "  3. Run: make services-up"
    exit 0
else
    echo -e "${RED}✗ Some builds failed${NC}"
    echo ""
    echo "Check the log files in /tmp/docker-build-*.log"
    echo "Fix the issues and run this script again."
    exit 1
fi
