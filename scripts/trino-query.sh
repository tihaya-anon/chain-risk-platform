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

log_info "Executing: $QUERY"
log_info "Trino server: http://${DOCKER_HOST_IP}:${TRINO_PORT}"

# Submit query
RESPONSE=$(curl -s -X POST "http://${DOCKER_HOST_IP}:${TRINO_PORT}/v1/statement" \
    -H "X-Trino-User: ${TRINO_USER}" \
    -H "Content-Type: text/plain" \
    -d "$QUERY")

# Check for immediate error
ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e.get('message') if e else '')" 2>/dev/null || echo "")
if [ -n "$ERROR" ]; then
    log_error "$ERROR"
    exit 1
fi

NEXT_URI=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('nextUri',''))" 2>/dev/null || echo "")

if [ -z "$NEXT_URI" ]; then
    # Maybe immediate result
    echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'columns' in d:
    cols = [c['name'] for c in d['columns']]
    print('\t'.join(cols))
if 'data' in d:
    for row in d['data']:
        print('\t'.join(str(v) for v in row))
" 2>/dev/null || echo "$RESPONSE"
    exit 0
fi

# Poll for results
while [ -n "$NEXT_URI" ]; do
    sleep 0.3
    RESPONSE=$(curl -s "$NEXT_URI" -H "X-Trino-User: ${TRINO_USER}")
    
    # Check for error
    ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e.get('message') if e else '')" 2>/dev/null || echo "")
    if [ -n "$ERROR" ]; then
        log_error "$ERROR"
        exit 1
    fi
    
    # Print columns header (only once)
    echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'columns' in d and d.get('data'):
    cols = [c['name'] for c in d['columns']]
    print('\t'.join(cols))
    print('-' * 40)
" 2>/dev/null || true
    
    # Print data
    echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'data' in d:
    for row in d['data']:
        print('\t'.join(str(v) if v is not None else 'NULL' for v in row))
" 2>/dev/null || true
    
    NEXT_URI=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('nextUri',''))" 2>/dev/null || echo "")
done

log_success "Query completed"
