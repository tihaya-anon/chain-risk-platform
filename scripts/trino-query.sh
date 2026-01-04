#!/bin/bash
# ============================================================
# Execute Trino SQL queries remotely
# ============================================================
# Usage:
#   ./scripts/trino-query.sh "SHOW CATALOGS"
#   ./scripts/trino-query.sh "SELECT * FROM hudi.chainrisk.transfers LIMIT 10"
#   DOCKER_HOST_IP=192.168.x.x ./scripts/trino-query.sh "SHOW SCHEMAS IN hudi"
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
TRINO_PORT="${TRINO_PORT:-18081}"
TRINO_USER="${TRINO_USER:-admin}"

QUERY="$1"

if [ -z "$QUERY" ]; then
    echo "Usage: $0 <SQL query>"
    echo ""
    echo "Examples:"
    echo "  $0 'SHOW CATALOGS'"
    echo "  $0 'SHOW SCHEMAS IN hudi'"
    echo "  $0 'SELECT * FROM hudi.chainrisk.transfers LIMIT 10'"
    exit 1
fi

# Check if trino CLI is installed locally
if command_exists trino; then
    log_info "Using local Trino CLI"
    trino --server "http://${DOCKER_HOST_IP}:${TRINO_PORT}" --user "$TRINO_USER" --execute "$QUERY"
else
    # Use curl to execute via REST API
    log_info "Using Trino REST API (install trino-cli for better output)"
    
    # Submit query
    RESPONSE=$(curl -s -X POST "http://${DOCKER_HOST_IP}:${TRINO_PORT}/v1/statement" \
        -H "X-Trino-User: ${TRINO_USER}" \
        -H "X-Trino-Source: trino-query-script" \
        -d "$QUERY")
    
    NEXT_URI=$(echo "$RESPONSE" | grep -o '"nextUri":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$NEXT_URI" ]; then
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        exit 1
    fi
    
    # Poll for results
    while [ -n "$NEXT_URI" ]; do
        sleep 0.5
        RESPONSE=$(curl -s "$NEXT_URI" -H "X-Trino-User: ${TRINO_USER}")
        NEXT_URI=$(echo "$RESPONSE" | grep -o '"nextUri":"[^"]*"' | cut -d'"' -f4)
        
        # Check for data
        DATA=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data', [])))" 2>/dev/null)
        if [ "$DATA" != "[]" ] && [ -n "$DATA" ]; then
            echo "$DATA" | python3 -m json.tool
        fi
    done
fi
