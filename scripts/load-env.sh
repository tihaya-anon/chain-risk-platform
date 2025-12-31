#!/bin/bash
# ============================================================
# Load environment variables for Chain Risk Platform
# ============================================================
# Usage: 
#   source scripts/load-env.sh              # Auto-detect from .env.local
#   source scripts/load-env.sh <IP>         # Specify Docker host IP
#   source scripts/load-env.sh localhost    # Use localhost
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Get Docker Host IP from argument or .env.local or default
if [ -n "$1" ]; then
    DOCKER_HOST_IP="$1"
elif [ -f "$PROJECT_ROOT/.env.local" ]; then
    # Extract DOCKER_HOST_IP from .env.local
    DOCKER_HOST_IP=$(grep "^DOCKER_HOST_IP=" "$PROJECT_ROOT/.env.local" | cut -d'=' -f2)
fi
DOCKER_HOST_IP=${DOCKER_HOST_IP:-localhost}

echo "============================================"
echo "Chain Risk Platform - Environment Setup"
echo "============================================"
echo "Docker Host IP: $DOCKER_HOST_IP"
echo "============================================"

# ==================== Base ====================
export DOCKER_HOST_IP

# ==================== Database ====================
export POSTGRES_HOST=$DOCKER_HOST_IP
export POSTGRES_PORT=15432
export POSTGRES_USER=chainrisk
export POSTGRES_PASSWORD=chainrisk123
export POSTGRES_DB=chainrisk

# ==================== Neo4j ====================
export NEO4J_HOST=$DOCKER_HOST_IP
export NEO4J_PORT=17687
export NEO4J_URI="bolt://${DOCKER_HOST_IP}:17687"
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=chainrisk123

# ==================== Redis ====================
export REDIS_HOST=$DOCKER_HOST_IP
export REDIS_PORT=16379
export REDIS_PASSWORD=

# ==================== Kafka ====================
export KAFKA_BROKERS="${DOCKER_HOST_IP}:19092"
export KAFKA_GROUP_ID=chain-risk-platform

# ==================== Nacos ====================
export NACOS_SERVER="${DOCKER_HOST_IP}:18848"
export NACOS_NAMESPACE=public
export NACOS_USERNAME=nacos
export NACOS_PASSWORD=nacos

# ==================== Monitoring ====================
export JAEGER_AGENT_HOST=$DOCKER_HOST_IP
export JAEGER_AGENT_PORT=6831
export JAEGER_ENDPOINT="http://${DOCKER_HOST_IP}:14268/api/traces"

# ==================== Service Ports ====================
export ORCHESTRATOR_PORT=8080
export BFF_PORT=3001
export QUERY_SERVICE_PORT=8081
export RISK_SERVICE_PORT=8082
export ALERT_SERVICE_PORT=8083
export GRAPH_ENGINE_PORT=8084
export DATA_INGESTION_PORT=9091

# ==================== Environment ====================
export NODE_ENV=development
export GO_ENV=development
export SPRING_PROFILES_ACTIVE=dev

# ==================== Load .env.local overrides ====================
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    echo "Loading overrides from .env.local..."
    while IFS='=' read -r key value; do
        # Skip comments, empty lines, and DOCKER_HOST_IP
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        [[ $key == "DOCKER_HOST_IP" ]] && continue
        # Remove leading/trailing whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        # Export if not empty
        if [ -n "$key" ] && [ -n "$value" ]; then
            export "$key=$value"
        fi
    done < "$PROJECT_ROOT/.env.local"
fi

echo ""
echo "Environment variables set:"
echo "  DOCKER_HOST_IP    = $DOCKER_HOST_IP"
echo "  NACOS_SERVER      = $NACOS_SERVER"
echo "  NACOS_USERNAME    = $NACOS_USERNAME"
echo "  KAFKA_BROKERS     = $KAFKA_BROKERS"
echo "  POSTGRES_HOST     = $POSTGRES_HOST"
echo "  REDIS_HOST        = $REDIS_HOST"
echo "  NEO4J_URI         = $NEO4J_URI"
echo "  JAEGER_ENDPOINT   = $JAEGER_ENDPOINT"
echo ""
echo "Ready to run services."
echo "============================================"
