#!/bin/bash
# Hudi Infrastructure Initialization Script

set -e

echo "=== Hudi Infrastructure Initialization ==="

# Wait for MinIO
echo "Waiting for MinIO..."
until curl -sf http://localhost:19000/minio/health/live > /dev/null 2>&1; do
    sleep 2
done
echo "MinIO is ready"

# Create buckets via MinIO API
echo "Creating MinIO buckets..."
docker exec minio mc alias set local http://localhost:9000 minioadmin minioadmin123 2>/dev/null || true
docker exec minio mc mb local/chainrisk-datalake --ignore-existing 2>/dev/null || true
docker exec minio mc mb local/chainrisk-warehouse --ignore-existing 2>/dev/null || true
echo "Buckets created"

# Wait for Hive Metastore
echo "Waiting for Hive Metastore..."
until nc -z localhost 19083 2>/dev/null; do
    sleep 2
done
echo "Hive Metastore is ready"

# Wait for Trino
echo "Waiting for Trino..."
until curl -sf http://localhost:18081/v1/info > /dev/null 2>&1; do
    sleep 2
done
echo "Trino is ready"

# Create Hudi schema via Trino
echo "Creating Hudi schema..."
docker exec trino trino --execute "CREATE SCHEMA IF NOT EXISTS hudi.chainrisk WITH (location = 's3a://chainrisk-datalake/hudi/')" 2>/dev/null || {
    echo "Schema creation failed, retrying..."
    sleep 5
    docker exec trino trino --execute "CREATE SCHEMA IF NOT EXISTS hudi.chainrisk WITH (location = 's3a://chainrisk-datalake/hudi/')"
}

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
