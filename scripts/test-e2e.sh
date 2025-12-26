#!/bin/bash
# scripts/test-e2e.sh

set -e

echo "=== Phase 1 End-to-End Test ==="

# 1. 检查基础设施
echo "[1/5] Checking infrastructure..."
docker-compose ps | grep -q "Up" || { echo "Infrastructure not running"; exit 1; }

# 2. 检查 Kafka topic
echo "[2/5] Checking Kafka topic..."
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list | grep -q "chain-transactions" || {
    echo "Creating topic..."
    docker exec kafka kafka-topics --create --bootstrap-server localhost:9092 \
        --topic chain-transactions --partitions 3 --replication-factor 1
}

# 3. 发送测试消息
echo "[3/5] Sending test message to Kafka..."
TEST_MSG='{"eventType":"transfer","network":"ethereum","blockNumber":12345678,"timestamp":"2024-01-01T00:00:00Z","data":{"txHash":"0xtest123","blockNumber":12345678,"logIndex":0,"from":"0xaaaa","to":"0xbbbb","value":"1000000000000000000","tokenSymbol":"ETH","tokenDecimal":18,"transferType":"native"}}'
echo $TEST_MSG | docker exec -i kafka kafka-console-producer --bootstrap-server localhost:9092 --topic chain-transactions

# 4. 等待处理
echo "[4/5] Waiting for processing (10s)..."
sleep 10

# 5. 验证数据库
echo "[5/5] Verifying database..."
RESULT=$(docker exec postgres psql -U chainrisk -d chainrisk -t -c "SELECT COUNT(*) FROM chain_data.transfers WHERE tx_hash='0xtest123'")
if [ "$RESULT" -gt 0 ]; then
    echo "✅ SUCCESS: Data found in database"
    docker exec postgres psql -U chainrisk -d chainrisk -c "SELECT tx_hash, from_address, to_address, value, transfer_type FROM chain_data.transfers WHERE tx_hash='0xtest123'"
else
    echo "❌ FAILED: No data found in database"
    exit 1
fi

echo "=== Test Complete ==="