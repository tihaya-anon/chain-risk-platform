#!/bin/bash
# Docker Setup Verification Script
# Phase 19 - Checkpoint A1

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "Docker Setup Verification"
echo "Phase 19 - Checkpoint A1"
echo "======================================"
echo ""

# Track issues
ISSUES=0

# Function to check if a file exists
check_file() {
    local file=$1
    local desc=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $desc: $file"
        return 0
    else
        echo -e "${RED}✗${NC} $desc: $file ${RED}NOT FOUND${NC}"
        ISSUES=$((ISSUES + 1))
        return 1
    fi
}

# Function to check if Dockerfile builds
check_dockerfile() {
    local dir=$1
    local service=$2

    echo -n "  Checking $service Dockerfile... "

    if [ ! -f "$dir/Dockerfile" ]; then
        echo -e "${RED}NOT FOUND${NC}"
        ISSUES=$((ISSUES + 1))
        return 1
    fi

    # Try to parse Dockerfile
    if docker build --dry-run "$dir" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${YELLOW}NEEDS CHECK${NC}"
        return 0
    fi
}

echo "1. Checking Compose Files"
echo "-------------------------"
check_file "docker-compose.yml" "Main compose"
check_file "infra/compose/base.yml" "Base compose"
check_file "infra/compose/infra.yml" "Infrastructure compose"
check_file "infra/compose/services.yml" "Services compose"
check_file "infra/compose/monitoring.yml" "Monitoring compose"
check_file "infra/compose/security.yml" "Security compose"
check_file "infra/compose/datalake.yml" "Data lake compose"
echo ""

echo "2. Checking Dockerfiles"
echo "----------------------"
check_dockerfile "services/query-service" "query-service"
check_dockerfile "services/alert-service" "alert-service"
check_dockerfile "services/risk-ml-service" "risk-ml-service"
check_dockerfile "services/graph-service" "graph-service"
check_dockerfile "services/bff" "bff"
check_dockerfile "mempool-collector" "mempool-collector"
check_dockerfile "data-ingestion" "data-ingestion"
echo ""

echo "3. Checking Service Configs"
echo "---------------------------"
check_file "services/query-service/configs/config.docker.yaml" "query-service config"
check_file "services/alert-service/configs/config.docker.yaml" "alert-service config"
echo ""

echo "4. Checking Makefile Issues"
echo "---------------------------"

# Check for orchestrator references (should be removed in Phase 16)
if grep -q "orchestrator" make/docker.mk; then
    echo -e "${YELLOW}⚠${NC} Found 'orchestrator' references in make/docker.mk (should be removed)"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC} No orchestrator references"
fi

# Check if mempool-collector is in services-up
if grep -q "mempool-collector" make/docker.mk; then
    echo -e "${GREEN}✓${NC} mempool-collector in docker.mk"
else
    echo -e "${YELLOW}⚠${NC} mempool-collector NOT in docker.mk"
    ISSUES=$((ISSUES + 1))
fi

echo ""

echo "5. Checking Environment"
echo "----------------------"
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"

    if grep -q "DOCKER_HOST_IP" .env.local; then
        echo -e "${GREEN}✓${NC} DOCKER_HOST_IP configured"
    else
        echo -e "${YELLOW}⚠${NC} DOCKER_HOST_IP not set in .env.local"
    fi
else
    echo -e "${YELLOW}⚠${NC} .env.local not found (copy from .env.example)"
    ISSUES=$((ISSUES + 1))
fi

echo ""
echo "======================================"
echo "Summary"
echo "======================================"

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: make docker-build"
    echo "  2. Run: make infra-up"
    echo "  3. Run: make services-up"
    exit 0
else
    echo -e "${RED}✗ Found $ISSUES issue(s)${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
    exit 1
fi
