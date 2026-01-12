#!/bin/bash
# Initialize Toxiproxy for chaos testing
# Usage: ./scripts/chaos/toxiproxy-init.sh

set -e

TOXIPROXY_API="${TOXIPROXY_API:-http://localhost:8474}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Toxiproxy Initialization ==="

wait_for_toxiproxy() {
    echo "Waiting for Toxiproxy API..."
    for i in $(seq 1 30); do
        if curl -sf "$TOXIPROXY_API/version" >/dev/null 2>&1; then
            echo "Toxiproxy is ready"
            return 0
        fi
        sleep 1
    done
    echo "ERROR: Toxiproxy not available"
    exit 1
}

verify_proxies() {
    echo "Verifying proxies..."
    local proxies
    proxies=$(curl -sf "$TOXIPROXY_API/proxies" | jq -r 'keys[]')
    
    for proxy in postgres-proxy redis-proxy kafka-proxy neo4j-proxy; do
        if echo "$proxies" | grep -q "^${proxy}$"; then
            echo "  ✓ $proxy"
        else
            echo "  ✗ $proxy (missing)"
            return 1
        fi
    done
}

test_proxy_connectivity() {
    echo "Testing proxy connectivity..."
    
    # Test PostgreSQL proxy
    if nc -z localhost 25432 2>/dev/null; then
        echo "  ✓ postgres-proxy (25432)"
    else
        echo "  ✗ postgres-proxy (25432)"
    fi
    
    # Test Redis proxy
    if nc -z localhost 26379 2>/dev/null; then
        echo "  ✓ redis-proxy (26379)"
    else
        echo "  ✗ redis-proxy (26379)"
    fi
    
    # Test Kafka proxy
    if nc -z localhost 29092 2>/dev/null; then
        echo "  ✓ kafka-proxy (29092)"
    else
        echo "  ✗ kafka-proxy (29092)"
    fi
    
    # Test Neo4j proxy
    if nc -z localhost 27687 2>/dev/null; then
        echo "  ✓ neo4j-proxy (27687)"
    else
        echo "  ✗ neo4j-proxy (27687)"
    fi
}

show_status() {
    echo ""
    echo "=== Proxy Status ==="
    curl -sf "$TOXIPROXY_API/proxies" | jq -r 'to_entries[] | "\(.key): \(.value.listen) -> \(.value.upstream) [enabled=\(.value.enabled)]"'
}

# Main
wait_for_toxiproxy
verify_proxies
test_proxy_connectivity
show_status

echo ""
echo "=== Initialization Complete ==="
echo "Toxiproxy API: $TOXIPROXY_API"
echo "Use chaos scenarios in tests/chaos/scenarios/"
