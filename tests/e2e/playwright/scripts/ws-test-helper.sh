#!/bin/bash
# WebSocket E2E Test Helper
# Injects alert events into Kafka for WebSocket E2E testing

set -e

SCRIPT_DIR=$(dirname "$0")

# Load environment
set -a
source "${SCRIPT_DIR}/../../../.env.local" 2>/dev/null || true
source "${SCRIPT_DIR}/../../../scripts/load-env.sh" 2>/dev/null || true
set +a

KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-localhost:19092}"
ALERT_TOPIC="chain-risk.alerts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  inject-alert     Inject a test alert into Kafka"
    echo "  inject-critical  Inject a critical severity alert"
    echo "  inject-batch     Inject multiple alerts"
    echo "  verify           Verify Kafka connectivity"
    echo ""
}

generate_alert() {
    local severity="${1:-high}"
    local type="${2:-high_risk_transfer}"
    local id="test-$(date +%s)-$RANDOM"
    local timestamp=$(date +%s000)

    cat <<EOF
{
  "id": "$id",
  "type": "$type",
  "severity": "$severity",
  "entityType": "address",
  "entityId": "0xtest${RANDOM}",
  "title": "E2E Test Alert - ${severity}",
  "message": "This is an automated E2E test alert with severity ${severity}",
  "riskScore": 0.85,
  "address": "0x$(openssl rand -hex 20)",
  "metadata": {
    "source": "e2e-test",
    "testRun": "$(date -u +%Y%m%d%H%M%S)"
  },
  "timestamp": $timestamp
}
EOF
}

inject_alert() {
    local severity="${1:-high}"
    local alert_json=$(generate_alert "$severity")

    echo -e "${YELLOW}Injecting alert to Kafka...${NC}"
    echo "$alert_json"

    # Check if kafka-console-producer is available
    if command -v kafka-console-producer &>/dev/null; then
        echo "$alert_json" | kafka-console-producer \
            --bootstrap-server "$KAFKA_BOOTSTRAP" \
            --topic "$ALERT_TOPIC"
    elif command -v docker &>/dev/null; then
        echo "$alert_json" | docker exec -i kafka kafka-console-producer \
            --bootstrap-server localhost:9092 \
            --topic "$ALERT_TOPIC"
    else
        echo -e "${RED}Error: No Kafka client available${NC}"
        echo "Please install kafka-console-producer or use Docker"
        return 1
    fi

    echo -e "${GREEN}✓ Alert injected successfully${NC}"
}

inject_batch() {
    local count="${1:-5}"
    local severities=("critical" "high" "medium" "low")

    echo -e "${YELLOW}Injecting $count alerts...${NC}"

    for ((i = 1; i <= count; i++)); do
        local severity=${severities[$((RANDOM % 4))]}
        inject_alert "$severity"
        sleep 0.5
    done

    echo -e "${GREEN}✓ Batch injection complete${NC}"
}

verify_kafka() {
    echo -e "${YELLOW}Verifying Kafka connectivity...${NC}"

    if command -v kafka-topics &>/dev/null; then
        kafka-topics --bootstrap-server "$KAFKA_BOOTSTRAP" --list
    elif command -v docker &>/dev/null; then
        docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
    else
        echo -e "${RED}Error: Cannot verify Kafka connectivity${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Kafka is reachable${NC}"
}

# Main
case "${1:-}" in
inject-alert)
    inject_alert "${2:-high}"
    ;;
inject-critical)
    inject_alert "critical"
    ;;
inject-batch)
    inject_batch "${2:-5}"
    ;;
verify)
    verify_kafka
    ;;
*)
    print_usage
    exit 1
    ;;
esac
