#!/bin/bash
# Hudi Infrastructure Initialization Script
# Run this after docker-compose up to initialize Hudi tables

set -e

echo "=== Hudi Infrastructure Initialization ==="

# Wait for services to be ready
echo "Waiting for MinIO..."
until curl -s http://localhost:19000/minio/health/live > /dev/null 2>&1; do
    sleep 2
done
echo "MinIO is ready"

echo "Waiting for Hive Metastore..."
until nc -z localhost 19083 2>/dev/null; do
    sleep 2
done
echo "Hive Metastore is ready"

echo "Waiting for Trino..."
until curl -s http://localhost:18081/v1/info > /dev/null 2>&1; do
    sleep 2
done
echo "Trino is ready"

# Create Hudi schema via Trino
echo "Creating Hudi schema..."
docker exec -it trino trino --execute "CREATE SCHEMA IF NOT EXISTS hudi.chainrisk WITH (location = 's3a://chainrisk-datalake/hudi/')"

echo "=== Hudi Infrastructure Ready ==="
echo ""
echo "Access points:"
echo "  - MinIO Console: http://localhost:19001 (minioadmin/minioadmin123)"
echo "  - Trino UI: http://localhost:18081"
echo ""
echo "To query Hudi tables:"
echo "  docker exec -it trino trino"
echo "  trino> USE hudi.chainrisk;"
echo "  trino> SHOW TABLES;"
