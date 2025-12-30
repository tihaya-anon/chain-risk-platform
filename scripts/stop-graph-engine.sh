#!/bin/bash

# Stop Graph Engine script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Find and kill graph-engine process
PIDS=$(pgrep -f "graph-engine.*\.jar" 2>/dev/null || true)

if [ -z "$PIDS" ]; then
    log_warn "No graph-engine process found"
    exit 0
fi

log_info "Found graph-engine process(es): $PIDS"

for PID in $PIDS; do
    log_info "Stopping process $PID..."
    kill "$PID" 2>/dev/null || true
done

# Wait for processes to stop
sleep 2

# Check if still running
REMAINING=$(pgrep -f "graph-engine.*\.jar" 2>/dev/null || true)
if [ -n "$REMAINING" ]; then
    log_warn "Force killing remaining processes: $REMAINING"
    for PID in $REMAINING; do
        kill -9 "$PID" 2>/dev/null || true
    done
fi

log_info "Graph Engine stopped"
