#!/bin/bash
# ============================================================
# Source this file to set up environment for remote Docker host
# Usage: source scripts/env-remote.sh <DOCKER_HOST_IP>
# Example: source scripts/env-remote.sh 192.168.1.100
# ============================================================

if [ -z "$1" ]; then
    # Try to read from .env.local
    if [ -f ".env.local" ]; then
        source .env.local 2>/dev/null
    fi
    
    if [ -z "$DOCKER_HOST_IP" ]; then
        echo "Usage: source $0 <DOCKER_HOST_IP>"
        echo "   or: Set DOCKER_HOST_IP in .env.local"
        return 1 2>/dev/null || exit 1
    fi
else
    DOCKER_HOST_IP="$1"
fi

echo "Setting up environment for Docker host: $DOCKER_HOST_IP"

# Export all service endpoints
export DOCKER_HOST_IP
export KAFKA_BROKERS="${DOCKER_HOST_IP}:19092"
export POSTGRES_HOST="${DOCKER_HOST_IP}"
export POSTGRES_PORT="15432"
export POSTGRES_USER="chainrisk"
export POSTGRES_PASSWORD="chainrisk123"
export REDIS_HOST="${DOCKER_HOST_IP}"
export REDIS_PORT="16379"
export NEO4J_HOST="${DOCKER_HOST_IP}"
export NEO4J_URI="bolt://${DOCKER_HOST_IP}:17687"
export NACOS_SERVER="${DOCKER_HOST_IP}:18848"
export JAEGER_AGENT_HOST="${DOCKER_HOST_IP}"
export JAEGER_ENDPOINT="http://${DOCKER_HOST_IP}:14268/api/traces"

echo ""
echo "Environment variables set:"
echo "  DOCKER_HOST_IP    = $DOCKER_HOST_IP"
echo "  KAFKA_BROKERS     = $KAFKA_BROKERS"
echo "  POSTGRES_HOST     = $POSTGRES_HOST"
echo "  REDIS_HOST        = $REDIS_HOST"
echo "  NEO4J_URI         = $NEO4J_URI"
echo "  NACOS_SERVER      = $NACOS_SERVER"
echo "  JAEGER_ENDPOINT   = $JAEGER_ENDPOINT"
echo ""
echo "You can now run services locally connecting to remote Docker."
