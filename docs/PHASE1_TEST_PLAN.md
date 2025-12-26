# Phase 1 测试计划

> 目标：验证核心数据流 `链上数据 → Kafka → Flink → PostgreSQL` 完整可用

## 📋 测试概览

| 测试类型 | 组件 | 状态 |
|----------|------|------|
| 单元测试 | data-ingestion | 🔲 |
| 单元测试 | stream-processor | 🔲 |
| 集成测试 | 基础设施 | 🔲 |
| 集成测试 | 端到端数据流 | 🔲 |

---

## 1️⃣ 基础设施验证

### 1.1 Docker Compose 启动测试

```bash
# 启动所有服务
docker-compose up -d

# 验证所有容器运行正常
docker-compose ps
```

**预期结果：** 所有容器状态为 `Up`

| 服务 | 端口 | 健康检查 |
|------|------|----------|
| PostgreSQL | 5432 | `pg_isready -U chainrisk` |
| Kafka | 9092 | `kafka-topics --bootstrap-server localhost:9092 --list` |
| Redis | 6379 | `redis-cli ping` |
| Neo4j | 7474/7687 | 访问 http://localhost:7474 |
| Nacos | 8848 | 访问 http://localhost:8848/nacos |
| Prometheus | 9090 | 访问 http://localhost:9090 |
| Grafana | 3001 | 访问 http://localhost:3001 |

### 1.2 数据库 Schema 验证

```bash
# 连接数据库
docker exec -it postgres psql -U chainrisk -d chainrisk

# 验证 schema 存在
\dn

# 验证表存在
\dt chain_data.*
\dt risk.*
\dt alert.*
```

**预期结果：**
- Schema: `chain_data`, `risk`, `alert`
- 表: `transfers`, `transactions`, `address_scores`, `address_labels`, `alerts`, `rules`, `processing_state`

### 1.3 Kafka Topic 创建测试

```bash
# 创建 topic
docker exec -it kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic chain-transactions \
  --partitions 3 \
  --replication-factor 1

# 验证 topic
docker exec -it kafka kafka-topics --describe \
  --bootstrap-server localhost:9092 \
  --topic chain-transactions
```

---

## 2️⃣ Data Ingestion 服务测试

### 2.1 单元测试

#### 2.1.1 Config 加载测试
```go
// test/config_test.go
func TestLoadConfig(t *testing.T) {
    cfg, err := config.Load("../configs/config.yaml")
    assert.NoError(t, err)
    assert.Equal(t, "ethereum", cfg.Blockchain.Network)
}
```

#### 2.1.2 Etherscan Client 测试
```go
// test/client_test.go
func TestGetLatestBlockNumber(t *testing.T) {
    client, _ := client.NewEtherscanClient("ethereum", baseURL, apiKey, 5)
    blockNum, err := client.GetLatestBlockNumber(context.Background())
    assert.NoError(t, err)
    assert.Greater(t, blockNum, uint64(0))
}
```

#### 2.1.3 Transfer 提取测试
```go
// test/service_test.go
func TestExtractNativeTransfer(t *testing.T) {
    tx := &model.Transaction{
        Hash:  "0x123",
        From:  "0xabc",
        To:    "0xdef",
        Value: big.NewInt(1000000000000000000), // 1 ETH
    }
    transfer := service.extractNativeTransfer(tx)
    assert.Equal(t, "native", transfer.TransferType)
    assert.Equal(t, "ETH", transfer.TokenSymbol)
}
```

### 2.2 集成测试

#### 2.2.1 Kafka Producer 测试

```bash
# 启动服务（mock 模式或真实 API）
cd data-ingestion
go run ./cmd/ingestion -config configs/config.yaml

# 另一个终端消费消息验证
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic chain-transactions \
  --from-beginning \
  --max-messages 5
```

**预期结果：** 能看到 JSON 格式的 ChainEvent 消息

#### 2.2.2 手动发送测试消息

```bash
# 发送测试消息到 Kafka
echo '{"eventType":"transaction","network":"ethereum","blockNumber":12345678,"timestamp":"2024-01-01T00:00:00Z","data":{"hash":"0xtest","blockNumber":12345678,"from":"0xabc","to":"0xdef","value":"1000000000000000000"}}' | \
docker exec -i kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic chain-transactions
```

---

## 3️⃣ Stream Processor 服务测试

### 3.1 单元测试

#### 3.1.1 ChainEvent 反序列化测试
```java
// src/test/java/com/chainrisk/stream/parser/ChainEventDeserializerTest.java
@Test
void testDeserialize() {
    String json = "{\"eventType\":\"transaction\",\"network\":\"ethereum\"}";
    ChainEventDeserializer deserializer = new ChainEventDeserializer();
    ChainEvent event = deserializer.deserialize(json.getBytes());
    assertEquals("transaction", event.getEventType());
    assertEquals("ethereum", event.getNetwork());
}
```

#### 3.1.2 TransferParser 测试
```java
// src/test/java/com/chainrisk/stream/parser/TransferParserTest.java
@Test
void testParseNativeTransfer() {
    ChainEvent event = createTestTransactionEvent();
    TransferParser parser = new TransferParser();
    List<Transfer> transfers = new ArrayList<>();
    parser.flatMap(event, transfers::add);
    assertEquals(1, transfers.size());
    assertEquals("native", transfers.get(0).getTransferType());
}
```

### 3.2 集成测试

#### 3.2.1 本地 Flink 运行测试

```bash
# 构建
cd processing
mvn clean package -pl stream-processor -am -DskipTests

# 本地运行（MiniCluster 模式）
java -cp stream-processor/target/stream-processor-1.0.0-SNAPSHOT.jar \
  com.chainrisk.stream.StreamProcessorApp \
  --kafka.brokers=localhost:9092 \
  --jdbc.url=jdbc:postgresql://localhost:5432/chainrisk
```

#### 3.2.2 验证数据写入 PostgreSQL

```sql
-- 连接数据库后执行
SELECT COUNT(*) FROM chain_data.transfers;

SELECT * FROM chain_data.transfers 
ORDER BY created_at DESC 
LIMIT 10;
```

**预期结果：** 能看到从 Kafka 消费并写入的 Transfer 记录

---

## 4️⃣ 端到端集成测试

### 4.1 完整数据流测试

```
测试流程：
1. 启动基础设施 (docker-compose up -d)
2. 启动 stream-processor
3. 启动 data-ingestion
4. 等待 1-2 分钟
5. 验证数据库中有数据
```

#### 4.1.1 测试脚本

```bash
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
```

### 4.2 性能基准测试

```bash
# 发送 1000 条测试消息
for i in {1..1000}; do
    echo "{\"eventType\":\"transfer\",\"network\":\"ethereum\",\"blockNumber\":$i,\"timestamp\":\"2024-01-01T00:00:00Z\",\"data\":{\"txHash\":\"0xperf$i\",\"blockNumber\":$i,\"logIndex\":0,\"from\":\"0xaaaa\",\"to\":\"0xbbbb\",\"value\":\"1000\",\"transferType\":\"native\"}}"
done | docker exec -i kafka kafka-console-producer --bootstrap-server localhost:9092 --topic chain-transactions

# 等待处理
sleep 30

# 验证
docker exec postgres psql -U chainrisk -d chainrisk -c "SELECT COUNT(*) FROM chain_data.transfers WHERE tx_hash LIKE '0xperf%'"
```

**预期结果：** 1000 条记录全部写入，处理时间 < 30秒

---

## 5️⃣ 测试检查清单

### Phase 1 完成标准

| # | 检查项 | 验证方法 | 状态 |
|---|--------|----------|------|
| 1 | Docker Compose 所有服务正常启动 | `docker-compose ps` | 🔲 |
| 2 | PostgreSQL schema 和表创建成功 | `\dt chain_data.*` | 🔲 |
| 3 | Kafka topic 创建成功 | `kafka-topics --list` | 🔲 |
| 4 | data-ingestion 能连接 Etherscan API | 查看日志 | 🔲 |
| 5 | data-ingestion 能发送消息到 Kafka | kafka-console-consumer | 🔲 |
| 6 | stream-processor 能消费 Kafka 消息 | 查看 Flink 日志 | 🔲 |
| 7 | stream-processor 能写入 PostgreSQL | SQL 查询 | 🔲 |
| 8 | 端到端数据流正常 | E2E 测试脚本 | 🔲 |
| 9 | 数据格式正确（Transfer 字段完整） | SQL 查询验证 | 🔲 |
| 10 | 无明显性能问题 | 1000 条 < 30s | 🔲 |

### 通过标准

- ✅ **10/10 通过**: Phase 1 完成，可进入 Phase 2
- ⚠️ **8-9/10 通过**: 有小问题，记录后可继续
- ❌ **< 8/10 通过**: 需要修复后重新测试

---

## 6️⃣ 已知限制和待改进

### 当前限制
1. ERC20 Transfer 仅支持从 input 解析，不支持 event log 解析
2. 未实现 checkpoint 持久化（重启后从头消费）
3. 未实现 exactly-once 语义

### Phase 2 前需完成
- [ ] 补充单元测试
- [ ] 添加 ERC20 event log 解析（可选）
- [ ] 配置 Flink checkpoint 到外部存储

---

## 📝 测试执行记录

| 日期 | 执行人 | 结果 | 备注 |
|------|--------|------|------|
| - | - | - | - |
