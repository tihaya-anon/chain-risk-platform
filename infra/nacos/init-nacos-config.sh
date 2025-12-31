#!/bin/bash
# Initialize Nacos configuration for Chain Risk Platform
# Usage: ./init-nacos-config.sh [NACOS_HOST] [USERNAME] [PASSWORD]

NACOS_HOST=${1:-${NACOS_SERVER:-localhost}}
NACOS_PORT=${NACOS_HOST##*:}
NACOS_HOST=${NACOS_HOST%%:*}
NACOS_PORT=${NACOS_PORT:-18848}

# Authentication credentials (default: nacos/nacos)
USERNAME=${2:-${NACOS_USERNAME:-nacos}}
PASSWORD=${3:-${NACOS_PASSWORD:-nacos}}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/chain-risk-pipeline.yaml"

echo "============================================"
echo "Nacos Configuration Initializer"
echo "============================================"
echo "Nacos Server: ${NACOS_HOST}:${NACOS_PORT}"
echo "Username: ${USERNAME}"
echo "Config File: ${CONFIG_FILE}"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Read config content
CONFIG_CONTENT=$(cat "$CONFIG_FILE")

echo "Step 1: Login to get access token..."
# Login to get access token
LOGIN_RESPONSE=$(curl -s -X POST "http://${NACOS_HOST}:${NACOS_PORT}/nacos/v1/auth/login" \
    -d "username=${USERNAME}&password=${PASSWORD}")

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Warning: Failed to get access token. Nacos auth may be disabled."
    echo "Response: $LOGIN_RESPONSE"
    echo "Proceeding without authentication..."
    AUTH_PARAM=""
else
    echo "Access token obtained successfully."
    AUTH_PARAM="&accessToken=${ACCESS_TOKEN}"
fi

echo ""
echo "Step 2: Publishing configuration to Nacos..."

# Publish configuration
RESPONSE=$(curl -s -X POST "http://${NACOS_HOST}:${NACOS_PORT}/nacos/v1/cs/configs?${AUTH_PARAM}" \
    -d "dataId=chain-risk-pipeline.yaml" \
    -d "group=DEFAULT_GROUP" \
    -d "type=yaml" \
    --data-urlencode "content=${CONFIG_CONTENT}")

if [ "$RESPONSE" == "true" ]; then
    echo "✅ Configuration published successfully!"
else
    echo "❌ Failed to publish configuration"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "Step 3: Verifying configuration..."

# Verify configuration
VERIFY_RESPONSE=$(curl -s -X GET "http://${NACOS_HOST}:${NACOS_PORT}/nacos/v1/cs/configs?dataId=chain-risk-pipeline.yaml&group=DEFAULT_GROUP${AUTH_PARAM}")

if [ -n "$VERIFY_RESPONSE" ] && [ "$VERIFY_RESPONSE" != "config data not exist" ]; then
    echo "✅ Configuration verified!"
    echo ""
    echo "============================================"
    echo "Configuration Content:"
    echo "============================================"
    echo "$VERIFY_RESPONSE"
else
    echo "❌ Failed to verify configuration"
    echo "Response: $VERIFY_RESPONSE"
fi

echo ""
echo "============================================"
echo "Nacos Console: http://${NACOS_HOST}:${NACOS_PORT}/nacos"
echo "Username: ${USERNAME}"
echo "============================================"
