#!/bin/bash
# ============================================================
# Initialize Nacos Configuration
# ============================================================
# Usage:
#   ./scripts/init-nacos-config.sh              # Use localhost
#   ./scripts/init-nacos-config.sh 192.168.1.x  # Use remote host
#   NACOS_SERVER=192.168.1.x:18848 ./scripts/init-nacos-config.sh
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get Nacos server address
if [ -n "$1" ]; then
    NACOS_SERVER="$1:18848"
elif [ -z "$NACOS_SERVER" ]; then
    # Try to read from .env.local
    if [ -f ".env.local" ]; then
        source .env.local 2>/dev/null
    fi
    NACOS_SERVER="${NACOS_SERVER:-localhost:18848}"
fi

NACOS_URL="http://${NACOS_SERVER}/nacos/v1/cs/configs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}"

echo "============================================"
echo "  Nacos Configuration Initializer"
echo "  Server: $NACOS_SERVER"
echo "============================================"
echo ""

# Function to publish config
publish_config() {
    local data_id=$1
    local group=$2
    local config_file=$3
    local config_type=$4

    if [ ! -f "$config_file" ]; then
        echo -e "${RED}✗ File not found: $config_file${NC}"
        return 1
    fi

    local content=$(cat "$config_file")
    
    printf "Publishing %-35s " "$data_id"
    
    response=$(curl -s -X POST "$NACOS_URL" \
        -d "dataId=$data_id" \
        -d "group=$group" \
        -d "type=$config_type" \
        --data-urlencode "content=$content")
    
    if [ "$response" = "true" ]; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} ($response)"
        return 1
    fi
}

# Check Nacos health
echo "Checking Nacos server..."
if ! curl -s "http://${NACOS_SERVER}/nacos/v1/console/health/readiness" > /dev/null; then
    echo -e "${RED}✗ Cannot connect to Nacos at $NACOS_SERVER${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Nacos server is healthy${NC}"
echo ""

# Publish configurations
echo "Publishing configurations..."
echo ""

# Shared pipeline config
publish_config "chain-risk-pipeline.yaml" "DEFAULT_GROUP" \
    "${CONFIG_DIR}/chain-risk-pipeline.yaml" "yaml"

echo ""
echo "============================================"
echo -e "${GREEN}Configuration initialization complete!${NC}"
echo "============================================"
echo ""
echo "View configurations at:"
echo "  http://${NACOS_SERVER}/nacos/#/configurationManagement"
echo ""
echo "Default credentials: nacos / nacos"
