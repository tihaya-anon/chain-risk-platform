#!/bin/bash
set -e

export HIVE_CONF_DIR=/opt/hive/conf

# Wait for postgres
echo "Waiting for PostgreSQL..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready"

# Initialize schema with postgres driver
echo "Initializing Hive Metastore schema..."
/opt/hive/bin/schematool -dbType postgres -initSchema --verbose || {
  echo "Schema might already exist, trying to validate..."
  /opt/hive/bin/schematool -dbType postgres -validate || true
}

echo "Starting Hive Metastore..."
exec /opt/hive/bin/hive --service metastore
