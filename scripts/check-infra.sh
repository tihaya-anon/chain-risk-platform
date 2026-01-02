#!/bin/bash
# ============================================================
# Quick Infrastructure Health Check
# ============================================================
# Usage:
#   Local:  ./scripts/check-infra.sh
#   Remote: ./scripts/check-infra.sh 192.168.x.x
#   Remote: DOCKER_HOST_IP=192.168.x.x ./scripts/check-infra.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common utilities
source "$SCRIPT_DIR/common.sh"

# Get Docker host IP from argument or environment
DOCKER_HOST_IP="${1:-${DOCKER_HOST_IP:-localhost}}"

echo "============================================"
echo "  Infrastructure Health Check"
echo "  Host: $DOCKER_HOST_IP"
echo "============================================"
echo ""

check_service() {
    local name=$1
    local check_cmd=$2
    local port=$3
    
    printf "%-15s " "$name"
    
    if eval "$check_cmd" &>/dev/null; then
        echo -e "${GREEN}✓ OK${NC} (port $port)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (port $port)"
        return 1
    fi
}

# Track failures
FAILED=0

# PostgreSQL
check_service "PostgreSQL" "PGPASSWORD=chainrisk123 psql -h $DOCKER_HOST_IP -p 15432 -U chainrisk -d chainrisk -c 'SELECT 1' 2>/dev/null" "15432" || ((FAILED++))

# Redis
check_service "Redis" "redis-cli -h $DOCKER_HOST_IP -p 16379 ping 2>/dev/null | grep -q PONG" "16379" || ((FAILED++))

# Kafka (via nc or kcat)
check_service "Kafka" "nc -z $DOCKER_HOST_IP 19092 2>/dev/null" "19092" || ((FAILED++))

# Neo4j
check_service "Neo4j" "curl -s http://${DOCKER_HOST_IP}:17474 >/dev/null" "17474" || ((FAILED++))

# Nacos
check_service "Nacos" "curl -s http://${DOCKER_HOST_IP}:18848/nacos/v1/console/health/readiness >/dev/null" "18848" || ((FAILED++))

# Prometheus
check_service "Prometheus" "curl -s http://${DOCKER_HOST_IP}:19090/-/healthy >/dev/null" "19090" || ((FAILED++))

# Grafana
check_service "Grafana" "curl -s http://${DOCKER_HOST_IP}:13001/api/health >/dev/null" "13001" || ((FAILED++))

# Jaeger
check_service "Jaeger" "curl -s http://${DOCKER_HOST_IP}:26686 >/dev/null" "26686" || ((FAILED++))

# Kafka Exporter
check_service "KafkaExporter" "curl -s http://${DOCKER_HOST_IP}:19308/metrics >/dev/null" "19308" || ((FAILED++))

# Postgres Exporter
check_service "PGExporter" "curl -s http://${DOCKER_HOST_IP}:19187/metrics >/dev/null" "19187" || ((FAILED++))

echo ""
echo "============================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All services healthy!${NC}"
else
    echo -e "${RED}$FAILED service(s) failed${NC}"
fi
echo "============================================"

# Print connection info
echo ""
echo "Connection URLs:"
echo "  PostgreSQL:         postgresql://chainrisk:chainrisk123@${DOCKER_HOST_IP}:15432/chainrisk"
echo "  Redis:              redis://${DOCKER_HOST_IP}:16379"
echo "  Kafka:              ${DOCKER_HOST_IP}:19092"
echo "  Neo4j:              bolt://${DOCKER_HOST_IP}:17687 (neo4j/chainrisk123)"
echo "  Nacos:              http://${DOCKER_HOST_IP}:18848/nacos"
echo "  Prometheus:         http://${DOCKER_HOST_IP}:19090"
echo "  Grafana:            http://${DOCKER_HOST_IP}:13001 (admin/admin123)"
echo "  Jaeger:             http://${DOCKER_HOST_IP}:26686"
echo "  Kafka Exporter:     http://${DOCKER_HOST_IP}:19308"
echo "  Postgres Exporter:  http://${DOCKER_HOST_IP}:19187"

exit $FAILED
