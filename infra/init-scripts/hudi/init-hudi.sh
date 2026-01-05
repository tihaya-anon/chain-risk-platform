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

# Create hudi directory structure in MinIO
echo "Creating Hudi directory structure..."
docker exec minio mc mb local/chainrisk-datalake/hudi --ignore-existing 2>/dev/null || true
echo "Hudi directory created"

# Wait for Hive Metastore
echo "Waiting for Hive Metastore..."
until nc -z localhost 19083 2>/dev/null; do
    sleep 2
done
sleep 5  # Extra wait for metastore to be fully ready
echo "Hive Metastore is ready"

# Create Hudi schema via Hive Metastore (beeline)
echo "Creating Hudi schema in Hive Metastore..."
docker exec hive-metastore beeline -u "jdbc:hive2://" --hiveconf hive.metastore.uris=thrift://localhost:9083 -e "
CREATE DATABASE IF NOT EXISTS chainrisk 
COMMENT 'Chain Risk Platform Hudi Data Lake' 
LOCATION 's3a://chainrisk-datalake/hudi/';
" 2>/dev/null || {
    echo "Beeline failed, trying alternative method..."
    # Alternative: create via direct metastore thrift if beeline fails
    docker exec hive-metastore hive --hiveconf hive.metastore.uris=thrift://localhost:9083 -e "
    CREATE DATABASE IF NOT EXISTS chainrisk LOCATION 's3a://chainrisk-datalake/hudi/';
    " 2>/dev/null || echo "Schema may already exist or will be created by Spark"
}

# Wait for Trino
echo "Waiting for Trino..."
until curl -sf http://localhost:18081/v1/info > /dev/null 2>&1; do
    sleep 2
done
echo "Trino is ready"

# Verify schema exists in Trino
echo "Verifying schema in Trino..."
docker exec trino trino --execute "SHOW SCHEMAS IN hudi" 2>/dev/null || true

echo "=== Hudi Infrastructure Ready ==="
echo ""
echo "Access points:"
echo "  - MinIO Console: http://localhost:19001 (minioadmin/minioadmin123)"
echo "  - Trino UI: http://localhost:18081"
echo ""
echo "Note: The 'chainrisk' schema will be fully available after running"
echo "the archive job which creates the Hudi tables with Hive sync."
echo ""
echo "To run archive job:"
echo "  ./scripts/run-archive-job.sh"
