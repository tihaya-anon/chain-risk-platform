#!/bin/bash
# ============================================================
# Load environment variables for Chain Risk Platform
# ============================================================
# Usage: 
#   source scripts/load-env.sh
#   source scripts/load-env.sh <IP>
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Get Docker Host IP from argument or .env.local or default
if [ -n "$1" ]; then
    DOCKER_HOST_IP="$1"
elif [ -f "$PROJECT_ROOT/.env.local" ]; then
    DOCKER_HOST_IP=$(grep "^DOCKER_HOST_IP=" "$PROJECT_ROOT/.env.local" | cut -d'=' -f2)
fi
DOCKER_HOST_IP=${DOCKER_HOST_IP:-localhost}

# ==================== Base ====================
export DOCKER_HOST_IP

# ==================== Database ====================
export POSTGRES_HOST=${POSTGRES_HOST:-$DOCKER_HOST_IP}
export POSTGRES_PORT=${POSTGRES_PORT:-15432}
export POSTGRES_USER=${POSTGRES_USER:-chainrisk}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-chainrisk123}
export POSTGRES_DB=${POSTGRES_DB:-chainrisk}

# ==================== Neo4j ====================
export NEO4J_HOST=${NEO4J_HOST:-$DOCKER_HOST_IP}
export NEO4J_PORT=${NEO4J_PORT:-17687}
export NEO4J_URI=${NEO4J_URI:-"bolt://${DOCKER_HOST_IP}:17687"}
export NEO4J_USER=${NEO4J_USER:-neo4j}
export NEO4J_PASSWORD=${NEO4J_PASSWORD:-chainrisk123}

# ==================== Redis ====================
export REDIS_HOST=${REDIS_HOST:-$DOCKER_HOST_IP}
export REDIS_PORT=${REDIS_PORT:-16379}
export REDIS_PASSWORD=${REDIS_PASSWORD:-}

# ==================== Kafka ====================
export KAFKA_BROKERS=${KAFKA_BROKERS:-"${DOCKER_HOST_IP}:19092"}
export KAFKA_GROUP_ID=${KAFKA_GROUP_ID:-chain-risk-platform}

# ==================== Nacos ====================
export NACOS_SERVER=${NACOS_SERVER:-"${DOCKER_HOST_IP}:18848"}
export NACOS_NAMESPACE=${NACOS_NAMESPACE:-}
export NACOS_USERNAME=${NACOS_USERNAME:-}
export NACOS_PASSWORD=${NACOS_PASSWORD:-}

# ==================== Hudi Data Lake ====================
export MINIO_ENDPOINT=${MINIO_ENDPOINT:-"http://${DOCKER_HOST_IP}:19000"}
export MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
export MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin123}
export HUDI_BASE_PATH=${HUDI_BASE_PATH:-"s3a://chainrisk-datalake/hudi"}
export TRINO_HOST=${TRINO_HOST:-$DOCKER_HOST_IP}
export TRINO_PORT=${TRINO_PORT:-18081}
export HIVE_METASTORE_URI=${HIVE_METASTORE_URI:-"thrift://${DOCKER_HOST_IP}:19083"}
export RETENTION_DAYS=${RETENTION_DAYS:-7}

# ==================== Monitoring ====================
export JAEGER_AGENT_HOST=${JAEGER_AGENT_HOST:-$DOCKER_HOST_IP}
export JAEGER_AGENT_PORT=${JAEGER_AGENT_PORT:-6831}
export JAEGER_ENDPOINT=${JAEGER_ENDPOINT:-"http://${DOCKER_HOST_IP}:14268/api/traces"}

# ==================== Service Ports ====================
export ORCHESTRATOR_PORT=${ORCHESTRATOR_PORT:-8080}
export BFF_PORT=${BFF_PORT:-3001}
export QUERY_SERVICE_PORT=${QUERY_SERVICE_PORT:-8081}
export RISK_SERVICE_PORT=${RISK_SERVICE_PORT:-8082}
export ALERT_SERVICE_PORT=${ALERT_SERVICE_PORT:-8083}
export GRAPH_ENGINE_PORT=${GRAPH_ENGINE_PORT:-8084}
export DATA_INGESTION_PORT=${DATA_INGESTION_PORT:-9091}

# ==================== Environment ====================
export NODE_ENV=${NODE_ENV:-development}
export GO_ENV=${GO_ENV:-development}
export SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-dev}

# ==================== Load .env.local overrides ====================
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    while IFS='=' read -r key value; do
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        [[ $key == "DOCKER_HOST_IP" ]] && continue
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        if [ -n "$key" ] && [ -n "$value" ]; then
            export "$key=$value"
        fi
    done < "$PROJECT_ROOT/.env.local"
fi
