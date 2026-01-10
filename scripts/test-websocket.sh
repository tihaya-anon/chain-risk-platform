#!/bin/bash
# ============================================================
# Test WebSocket Connection
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BFF_HOST="${DOCKER_HOST_IP:-localhost}"
BFF_PORT="${BFF_PORT:-3001}"
WS_URL="ws://${BFF_HOST}:${BFF_PORT}/alerts"

echo "============================================"
echo "  WebSocket Gateway Test"
echo "  URL: $WS_URL"
echo "============================================"

# Check if wscat is available
if ! command -v wscat &> /dev/null; then
    echo -e "${YELLOW}wscat not found. Install with: npm install -g wscat${NC}"
    echo ""
    echo "Alternative test with curl:"
    echo "  curl -s http://${BFF_HOST}:${BFF_PORT}/admin/ws/stats"
    echo ""
    
    # Try curl endpoint
    echo "Testing WebSocket stats endpoint..."
    STATS=$(curl -s "http://${BFF_HOST}:${BFF_PORT}/admin/ws/stats" 2>/dev/null)
    if [ -n "$STATS" ]; then
        echo -e "${GREEN}✓ WebSocket Gateway is running${NC}"
        echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
    else
        echo -e "${RED}✗ Could not connect to WebSocket stats endpoint${NC}"
        exit 1
    fi
    exit 0
fi

# Test with wscat
echo "Connecting to WebSocket..."
echo '{"event": "ping"}' | timeout 5 wscat -c "$WS_URL" -x '{"event":"ping"}' 2>/dev/null && \
    echo -e "${GREEN}✓ WebSocket connection successful${NC}" || \
    echo -e "${RED}✗ WebSocket connection failed${NC}"
