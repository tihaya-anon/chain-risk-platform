#!/bin/bash
# Phase 10 Deployment Test Script
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
log_pass() { echo -e "${GREEN}✓${NC} $1"; }
log_fail() { echo -e "${RED}✗${NC} $1"; }

cd "$(dirname "$0")/.."

set -a && source .env.local && source ./scripts/load-env.sh > /dev/null 2>&1 && set +a

echo "================================================"
echo "  Phase 10 Deployment Test"
echo "================================================"

log_step "1. Starting Vault and Elasticsearch"
docker-compose up -d vault elasticsearch
echo "Waiting 15s for services..."
sleep 15

log_step "2. Checking Vault"
VAULT_STATUS=$(curl -s http://localhost:18200/v1/sys/health 2>/dev/null || echo '{"error":true}')
if echo "$VAULT_STATUS" | grep -q '"initialized"'; then
    log_pass "Vault running (initialized: $(echo $VAULT_STATUS | jq -r .initialized), sealed: $(echo $VAULT_STATUS | jq -r .sealed))"
else
    log_fail "Vault not accessible"
fi

log_step "3. Checking Elasticsearch"
ES_HEALTH=$(curl -s http://localhost:19200/_cluster/health 2>/dev/null || echo '{}')
if echo "$ES_HEALTH" | grep -q '"status"'; then
    log_pass "Elasticsearch status: $(echo "$ES_HEALTH" | jq -r .status)"
else
    log_fail "Elasticsearch not accessible"
fi

log_step "4. Restarting Jaeger with ES backend"
docker-compose up -d jaeger
sleep 5
curl -sf http://localhost:26686/api/services > /dev/null 2>&1 && log_pass "Jaeger API accessible" || log_fail "Jaeger not accessible"

log_step "5. Building Docker images"
for svc in query-service alert-service risk-ml-service graph-service orchestrator bff; do
    echo "  Building $svc..."
    docker build -t chainrisk/$svc:latest services/$svc -q > /dev/null 2>&1 && log_pass "$svc" || log_fail "$svc"
done

log_step "6. Built images"
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | grep chainrisk || echo "None"

log_step "7. Resource status"
free -h | head -2
echo ""
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}' | head -10

echo ""
echo "Next: docker-compose --profile services up -d"
