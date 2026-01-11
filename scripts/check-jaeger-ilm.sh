#!/bin/bash
# ============================================================
# Check Jaeger ILM Status
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
ES_URL="http://${DOCKER_HOST_IP}:19200"

echo "============================================"
echo "  Jaeger ILM Status"
echo "============================================"

# Check ILM policy
echo -e "\n📋 ILM Policy:"
curl -s "${ES_URL}/_ilm/policy/jaeger-traces-policy" | python3 -m json.tool 2>/dev/null || \
    echo "Policy not found or python3 not available"

# Check index lifecycle status
echo -e "\n📊 Index Lifecycle Status:"
curl -s "${ES_URL}/jaeger-*/_ilm/explain" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    indices = data.get('indices', {})
    if not indices:
        print('  No Jaeger indices found')
    for idx, info in indices.items():
        phase = info.get('phase', 'N/A')
        age = info.get('age', 'N/A')
        print(f'  {idx}: phase={phase}, age={age}')
except:
    print('  Unable to parse ILM status')
" 2>/dev/null || echo "  Unable to check ILM status"

# Check index sizes
echo -e "\n💾 Index Sizes:"
curl -s "${ES_URL}/_cat/indices/jaeger*?v&h=index,store.size,docs.count&s=index" 2>/dev/null || \
    echo "  No indices found"

echo ""
