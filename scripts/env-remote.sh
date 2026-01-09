#!/bin/bash
# Remote Infrastructure Environment Configuration
# Usage: source scripts/env-remote.sh <REMOTE_HOST_IP>

REMOTE_HOST="${1:-192.168.1.100}"

echo "Configuring remote infrastructure at: ${REMOTE_HOST}"

# ============== Message Queue ==============
export KAFKA_BROKERS="${REMOTE_HOST}:19092"
export KAFKA_BOOTSTRAP_SERVERS="${REMOTE_HOST}:19092"
export ZOOKEEPER_CONNECT="${REMOTE_HOST}:12181"

# ============== Databases ==============
# PostgreSQL
export POSTGRES_HOST="${REMOTE_HOST}"
export POSTGRES_PORT="15432"
export POSTGRES_USER="chainrisk"
export POSTGRES_PASSWORD="chainrisk123"
export POSTGRES_DB="chainrisk"
export POSTGRES_URL="jdbc:postgresql://${REMOTE_HOST}:15432/chainrisk"
export DATABASE_URL="postgresql://chainrisk:chainrisk123@${REMOTE_HOST}:15432/chainrisk"

# Neo4j
export NEO4J_HOST="${REMOTE_HOST}"
export NEO4J_URI="bolt://${REMOTE_HOST}:17687"
export NEO4J_HTTP="http://${REMOTE_HOST}:17474"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="chainrisk123"

# Redis
export REDIS_HOST="${REMOTE_HOST}"
export REDIS_PORT="16379"
export REDIS_URL="redis://${REMOTE_HOST}:16379"

# ============== Data Lake ==============
# MinIO
export MINIO_ENDPOINT="http://${REMOTE_HOST}:19000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin123"
export AWS_ACCESS_KEY_ID="minioadmin"
export AWS_SECRET_ACCESS_KEY="minioadmin123"
export AWS_ENDPOINT_URL="http://${REMOTE_HOST}:19000"

# Hive Metastore
export HIVE_METASTORE_URI="thrift://${REMOTE_HOST}:19083"
export HIVE_METASTORE_URIS="thrift://${REMOTE_HOST}:19083"

# Trino
export TRINO_URL="http://${REMOTE_HOST}:18081"
export TRINO_HOST="${REMOTE_HOST}"
export TRINO_PORT="18081"

# ============== Service Discovery ==============
export NACOS_SERVER="${REMOTE_HOST}:18848"
export NACOS_ADDR="${REMOTE_HOST}:18848"
export NACOS_USERNAME="nacos"
export NACOS_PASSWORD="nacos"

# ============== Monitoring ==============
export PROMETHEUS_URL="http://${REMOTE_HOST}:19090"
export GRAFANA_URL="http://${REMOTE_HOST}:13001"

# ============== Tracing ==============
export JAEGER_URL="http://${REMOTE_HOST}:26686"
export JAEGER_AGENT_HOST="${REMOTE_HOST}"
export JAEGER_AGENT_PORT="16831"
export OTEL_EXPORTER_JAEGER_ENDPOINT="http://${REMOTE_HOST}:14268/api/traces"

# ============== UI Tools ==============
export PGADMIN_URL="http://${REMOTE_HOST}:15050"
export REDISINSIGHT_URL="http://${REMOTE_HOST}:15540"
export KAFKA_UI_URL="http://${REMOTE_HOST}:18080"
export MINIO_CONSOLE_URL="http://${REMOTE_HOST}:19001"

echo ""
echo "Environment configured for remote host: ${REMOTE_HOST}"
echo ""
echo "Quick Access URLs:"
echo "  Kafka UI:      ${KAFKA_UI_URL}"
echo "  Grafana:       ${GRAFANA_URL}"
echo "  Jaeger:        ${JAEGER_URL}"
echo "  Nacos:         http://${NACOS_SERVER}/nacos"
echo "  pgAdmin:       ${PGADMIN_URL}"
echo "  MinIO Console: ${MINIO_CONSOLE_URL}"
echo "  Neo4j Browser: ${NEO4J_HTTP}"
echo ""
