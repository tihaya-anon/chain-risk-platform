# Integration Test Troubleshooting Guide

> 集成测试问题排查和解决方案

**Last Updated**: 2026-01-03

---

## 🐛 常见问题

### 问题 1: Transfer count = 0, Transaction count = 0

#### 症状
```
[ERROR] Transfer count (0) is less than expected (90)!
[ERROR] Transaction count (0) is less than expected (30)!
```

#### 原因分析

1. **Flink 运行时间不足**
   - Flink 启动需要 5-10 秒
   - 连接 Kafka/PostgreSQL/Neo4j 需要时间
   - 消费和处理消息需要时间
   - 原来只等待 30 秒不够

2. **时序问题**
   ```
   data-ingestion (60s) → 停止
                          ↓
   Flink 启动 (5-10s)    ← 数据已经在 Kafka
                          ↓
   消费消息 (20-30s)
                          ↓
   等待 30s              ← 太短！
                          ↓
   验证 (0 条数据)       ← 失败
   ```

#### 解决方案

**修改前**:
```bash
sleep 30  # 固定等待 30 秒
```

**修改后**:
```bash
# 1. 初始等待 60 秒
sleep 60

# 2. 轮询检查数据（最多 5 次，每次 10 秒）
for i in {1..5}; do
    TRANSFER_COUNT=$(psql -c "SELECT COUNT(*) FROM transfers")
    if [ "$TRANSFER_COUNT" -gt 0 ]; then
        log_info "Data found! Transfer count: $TRANSFER_COUNT"
        break
    fi
    log_warn "No data yet (attempt $i/5), waiting 10 more seconds..."
    sleep 10
done
```

**总等待时间**: 60s + (最多 50s) = 最多 110 秒

---

### 问题 2: Kafka Producer 连接 localhost:19092

#### 症状
```
[WARN] Connection to node -1 (localhost/127.0.0.1:19092) could not be established
```

#### 原因
- `kafka.transfers.brokers` 参数没有传递给 Flink
- 默认值是 `localhost:19092` 而不是远程地址

#### 解决方案
已在 `run-flink.sh` 中修复：
```bash
JAVA_ARGS+=(--kafka.transfers.brokers "${KAFKA_BROKERS}")
```

---

### 问题 3: Flink 无法停止

#### 症状
- Ctrl+C 无法停止 Flink
- 必须用任务管理器

#### 解决方案
使用 tmux：
```bash
# 启动 Flink
make flink-run

# 停止 Flink
make flink-stop

# 查看日志
make flink-logs
```

---

## 🔍 调试步骤

### 1. 检查基础设施
```bash
make infra-check
```

应该看到所有服务都是 ✓ OK。

### 2. 检查 Kafka 中的数据
```bash
# 列出 topics
kcat -b 100.120.144.128:19092 -L

# 查看消息数量
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o beginning | wc -l

# 查看最新几条消息
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o -5
```

### 3. 检查 Flink 日志
```bash
# 实时查看
make flink-logs

# 或查看文件
tail -f processing/stream-processor/logs/stream-processor.log

# 查找错误
grep -i "error\|exception\|failed" processing/stream-processor/logs/stream-processor.log
```

### 4. 检查 PostgreSQL 数据
```bash
# 连接数据库
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk

# 查看表数据
SELECT COUNT(*) FROM chain_data.transfers;
SELECT COUNT(*) FROM chain_data.transactions;

# 查看最新数据
SELECT * FROM chain_data.transfers ORDER BY block_number DESC LIMIT 5;
```

### 5. 检查 Neo4j 数据
```bash
# 使用 cypher-shell
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123

# 查询节点数
MATCH (a:Address) RETURN count(a);

# 查询关系数
MATCH ()-[r:TRANSFER]->() RETURN count(r);

# 查看 source 标记
MATCH ()-[r:TRANSFER]->() RETURN r.source, count(r);
```

---

## 📊 预期结果

### Kafka
- Topic: `chain-transactions`
- Messages: 30 条（NUM_BLOCKS=30）
- Offsets: 连续的

### PostgreSQL
- Transfers: ≥90 条（~3 per block）
- Transactions: ≥30 条（≥1 per block）
- Processing state: last_processed_block ≥ START_BLOCK + NUM_BLOCKS - 1

### Neo4j
- Address nodes: >0
- TRANSFER relationships: ≥90
- All marked with `source='stream'`

---

## 🚀 完整测试流程

### 1. 准备环境
```bash
# 确保基础设施运行
make infra-check

# 停止之前的 Flink
make flink-stop

# 清理旧数据（可选）
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "TRUNCATE chain_data.transfers CASCADE"
```

### 2. 运行测试
```bash
make test-integration
```

### 3. 观察日志
在另一个终端：
```bash
# 观察 Flink 日志
make flink-logs

# 或
tmux attach -t flink-stream
```

### 4. 验证结果
测试应该输出：
```
[INFO] PostgreSQL Results:
[INFO]   - Transfers: 90 (expected: >=90)
[INFO]   - Transactions: 30 (expected: >=30)
[INFO]   - Last processed block: 1029
[INFO] ✓ Transfer count validation passed
[INFO] ✓ Transaction count validation passed
[INFO] ✓ Processing state validation passed

[INFO] Neo4j Results:
[INFO]   - Address nodes: 60
[INFO]   - TRANSFER relationships: 90
[INFO]   - Stream-sourced transfers: 90
[INFO] ✓ Neo4j dual-write validation passed
[INFO] ✓ All transfers correctly marked with source='stream'

[INFO] ✅ Integration Test Complete
```

---

## 🔧 配置调整

### 增加测试数据量
编辑 `scripts/run-integration-test.sh`:
```bash
NUM_BLOCKS=50  # 增加到 50 个区块
EXPECTED_TRANSFERS=$((NUM_BLOCKS * 3))  # 自动调整
```

### 调整等待时间
```bash
# 初始等待时间
sleep 90  # 增加到 90 秒

# 轮询次数
for i in {1..10}; do  # 增加到 10 次
    ...
    sleep 15  # 每次等待 15 秒
done
```

### 禁用 Neo4j 测试
```bash
export ENABLE_NEO4J_SINK=false
./scripts/run-integration-test.sh
```

---

## 📚 相关文档

- [Bug Fixes](./BUG_FIXES.md)
- [Phase 1 Summary](./PHASE1_SUMMARY.md)
- [Integration Test README](../../tests/integration/README.md)

---

## 💡 提示

1. **首次运行**可能需要更长时间（Maven 下载依赖）
2. **tmux** 是可选的，但强烈推荐安装
3. **cypher-shell** 用于 Neo4j 验证，可选安装
4. **kcat/kafkacat** 用于 Kafka 调试，推荐安装

### 安装工具
```bash
# macOS
brew install tmux cypher-shell kcat

# Linux
apt-get install tmux cypher-shell kafkacat
```

---

**Last Updated**: 2026-01-03
