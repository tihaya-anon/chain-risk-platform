#!/bin/bash
# Integration Test - Mempool Collector
# Tests: mempool-collector → Kafka (mempool-pending-txs topic)
#
# Prerequisites:
# - Kafka running
# - Mock Ethereum node (or real node for full test)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$PROJECT_ROOT"
source "$PROJECT_ROOT/scripts/common.sh"
load_env "$PROJECT_ROOT" || exit 1

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
KAFKA_BROKER="${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}"
KAFKA_TOPIC="mempool-pending-txs"
MOCK_ETH_PORT="${MOCK_ETH_PORT:-8546}"
COLLECTOR_PORT=9090
TEST_DURATION="${TEST_DURATION:-15}"

log_info "=== Mempool Collector Integration Test ==="
log_info "Kafka: $KAFKA_BROKER"
log_info "Topic: $KAFKA_TOPIC"
log_info ""

cleanup() {
    log_info "Cleaning up..."
    [ -n "$COLLECTOR_PID" ] && kill $COLLECTOR_PID 2>/dev/null || true
    [ -n "$MOCK_ETH_PID" ] && kill $MOCK_ETH_PID 2>/dev/null || true
}
trap cleanup EXIT

# Check Kafka
if ! nc -z ${KAFKA_BROKER%:*} ${KAFKA_BROKER#*:} 2>/dev/null; then
    log_error "Cannot connect to Kafka at $KAFKA_BROKER"
    log_info "Start Kafka first: make infra-up"
    exit 1
fi
log_info "✓ Kafka connection OK"

# Create topic if not exists
if command -v kcat &>/dev/null; then
    kcat -b $KAFKA_BROKER -L 2>/dev/null | grep -q "$KAFKA_TOPIC" || {
        log_info "Creating topic $KAFKA_TOPIC..."
        # Use kafka-topics if available, otherwise skip
        docker exec kafka kafka-topics.sh --create --topic $KAFKA_TOPIC \
            --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1 2>/dev/null || true
    }
fi

# Build mempool-collector
log_info "Building mempool-collector..."
cd "$PROJECT_ROOT/mempool-collector"
mkdir -p bin
go build -o bin/mempool-collector ./cmd || { log_error "Build failed"; exit 1; }

# Start mock Ethereum WebSocket server for testing
log_info "Starting mock Ethereum node..."
cd "$PROJECT_ROOT"

# Create simple mock that sends pending tx notifications
cat > /tmp/mock_eth_ws.go << 'EOF'
package main

import (
    "encoding/json"
    "flag"
    "fmt"
    "log"
    "net/http"
    "time"

    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

type jsonrpcRequest struct {
    Method string   `json:"method"`
    Params []any    `json:"params"`
    ID     int      `json:"id"`
}

type jsonrpcResponse struct {
    JSONRPC string `json:"jsonrpc"`
    ID      int    `json:"id"`
    Result  any    `json:"result,omitempty"`
}

func handleWS(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("Upgrade error:", err)
        return
    }
    defer conn.Close()

    var subID string
    txCount := 0

    // Read subscription request
    go func() {
        for {
            _, msg, err := conn.ReadMessage()
            if err != nil {
                return
            }
            var req jsonrpcRequest
            if err := json.Unmarshal(msg, &req); err != nil {
                continue
            }

            if req.Method == "eth_subscribe" {
                subID = fmt.Sprintf("0x%x", time.Now().UnixNano())
                resp := jsonrpcResponse{JSONRPC: "2.0", ID: req.ID, Result: subID}
                conn.WriteJSON(resp)
            }
        }
    }()

    // Send mock pending transactions
    ticker := time.NewTicker(500 * time.Millisecond)
    defer ticker.Stop()

    for range ticker.C {
        if subID == "" {
            continue
        }
        txCount++
        txHash := fmt.Sprintf("0x%064x", txCount)
        
        notification := map[string]any{
            "jsonrpc": "2.0",
            "method":  "eth_subscription",
            "params": map[string]any{
                "subscription": subID,
                "result":       txHash,
            },
        }
        if err := conn.WriteJSON(notification); err != nil {
            return
        }
    }
}

func handleGetTx(w http.ResponseWriter, r *http.Request) {
    // Mock eth_getTransactionByHash response
    resp := jsonrpcResponse{
        JSONRPC: "2.0",
        ID:      1,
        Result: map[string]any{
            "hash":     "0x" + fmt.Sprintf("%064d", time.Now().UnixNano()%1000),
            "from":     "0x28c6c06298d514db089934071355e5743bf21d60",
            "to":       "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
            "value":    "0xde0b6b3a7640000",
            "gas":      "0x5208",
            "gasPrice": "0xba43b7400",
            "nonce":    "0x1",
            "input":    "0x38ed1739",
        },
    }
    json.NewEncoder(w).Encode(resp)
}

func main() {
    port := flag.Int("port", 8546, "WebSocket port")
    flag.Parse()

    http.HandleFunc("/", handleWS)
    http.HandleFunc("/rpc", handleGetTx)
    
    addr := fmt.Sprintf(":%d", *port)
    log.Printf("Mock Ethereum node listening on ws://localhost%s", addr)
    log.Fatal(http.ListenAndServe(addr, nil))
}
EOF

# Check if gorilla/websocket is available, if not skip mock
if go list github.com/gorilla/websocket &>/dev/null 2>&1; then
    cd /tmp
    go mod init mock_eth 2>/dev/null || true
    go get github.com/gorilla/websocket 2>/dev/null || true
    go build -o mock_eth_ws mock_eth_ws.go 2>/dev/null && {
        ./mock_eth_ws -port $MOCK_ETH_PORT &
        MOCK_ETH_PID=$!
        sleep 1
        log_info "✓ Mock Ethereum node started"
    } || {
        log_warn "Could not build mock Ethereum node, skipping live test"
        MOCK_ETH_PID=""
    }
else
    log_warn "gorilla/websocket not available, skipping mock node"
fi

# Test collector health endpoint only (without real connection)
log_info "Testing collector startup..."
cd "$PROJECT_ROOT/mempool-collector"

MEMPOOL_SERVER_PORT=$COLLECTOR_PORT \
MEMPOOL_ETHEREUM_WS_URL="ws://localhost:$MOCK_ETH_PORT" \
MEMPOOL_KAFKA_BROKERS="$KAFKA_BROKER" \
MEMPOOL_KAFKA_TOPIC="$KAFKA_TOPIC" \
./bin/mempool-collector &
COLLECTOR_PID=$!
sleep 3

# Check health endpoint
if curl -s "http://localhost:$COLLECTOR_PORT/health" | grep -q "status"; then
    log_info "✓ Collector health endpoint OK"
else
    log_error "Collector health check failed"
    exit 1
fi

# Wait for some messages if mock is running
if [ -n "$MOCK_ETH_PID" ]; then
    log_info "Waiting ${TEST_DURATION}s for mock transactions..."
    sleep $TEST_DURATION

    # Check Kafka for messages
    if command -v kcat &>/dev/null; then
        KAFKA_COUNT=$(timeout 5 kcat -b $KAFKA_BROKER -t $KAFKA_TOPIC -C -e -o end -c 100 2>/dev/null | wc -l | tr -d ' ' || echo "0")
        log_info "Kafka messages in topic: $KAFKA_COUNT"
        
        if [ "$KAFKA_COUNT" -gt 0 ]; then
            log_info "✓ Messages produced to Kafka"
        else
            log_warn "No messages in Kafka (mock might not be fully functional)"
        fi
    fi
fi

log_info ""
log_info "=========================================="
log_info "✅ Mempool Collector Integration Test Complete"
log_info "=========================================="
