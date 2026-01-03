# Three-Phase Integration Testing

> Lambda Architecture 完整测试流程：Speed Layer + Batch Layer

**Date**: 2026-01-03  
**Branch**: `feature/lambda-architecture-implementation`

---

## 🎯 目标

将 Lambda 架构的集成测试分为三个独立阶段，提高开发效率：

1. **Phase 1**: 数据采集到 Kafka（一次性）
2. **Phase 2**: Flink 流处理（可重复，测试 Speed Layer）
3. **Phase 3**: Spark 批处理（可重复，测试 Batch Layer）

---

## 📊 测试架构

### Lambda Architecture 测试流程

```
Phase 1 (一次性运行):
Mock Server → data-ingestion → Kafka
   (30s)         (60s)
总时间: ~90 秒

Phase 2 (可重复运行 - Speed Layer):
Kafka → Flink Stream → PostgreSQL + Neo4j (source='stream')
           (60s)
总时间: ~60 秒

Phase 3 (可重复运行 - Batch Layer):
PostgreSQL (stream) → Spark Batch → PostgreSQL + Neo4j (source='batch')
                         (30s)
总时间: ~30 秒
```

**效率提升**:
- 首次完整测试: 90 + 60 + 30 = **180 秒**
- 重复测试 Phase 2: **60 秒**
- 重复测试 Phase 3: **30 秒**
- 重复测试 Phase 2 + 3: **90 秒**

---

## 🚀 使用方法

### 完整测试（首次运行）

```bash
# 运行完整 Lambda 架构测试
make test-integration-phase1  # 数据采集
make test-integration-phase2  # Speed Layer
make test-integration-phase3  # Batch Layer
```

### Phase 1: 数据采集到 Kafka

```bash
# 只运行 Phase 1（采集数据到 Kafka）
make test-integration-phase1

# 或直接运行脚本
./scripts/test-integration-phase1.sh
```

**何时运行**:
- ✅ 修改了 data-ingestion 代码
- ✅ 需要更新测试数据
- ✅ Kafka 中没有测试数据
- ✅ 首次运行测试

**输出**:
```
[INFO] ✅ Phase 1 Complete
[INFO] Kafka topic 'chain-transactions' now contains 30 blocks of test data
[INFO] Next steps: Run Phase 2 or Phase 3
```

### Phase 2: Flink Stream Processing (Speed Layer)

```bash
# 运行 Phase 2（Flink 消费 Kafka 数据）
make test-integration-phase2

# 或直接运行脚本
./scripts/test-integration-phase2.sh
```

**何时运行**:
- ✅ 修改了 Flink stream-processor 代码
- ✅ 修改了 Neo4j Sink
- ✅ 修改了 Kafka Producer
- ✅ 调整了配置参数
- ✅ 需要快速验证 Speed Layer

**输出**:
```
[INFO] Consumer Group: stream-processor-test-1704240000 (dynamic)
[INFO] PostgreSQL Results:
[INFO]   - Transfers: 90 (source='stream')
[INFO]   - Transactions: 30
[INFO] Neo4j Results:
[INFO]   - Address nodes: 60
[INFO]   - TRANSFER relationships: 90 (source='stream')
[INFO] ✅ Phase 2 Complete
```

### Phase 3: Spark Batch Processing (Batch Layer)

```bash
# 运行 Phase 3（Spark 批处理修正数据）
make test-integration-phase3

# 或直接运行脚本
./scripts/test-integration-phase3.sh
```

**何时运行**:
- ✅ 修改了 Spark batch-processor 代码
- ✅ 修改了批处理逻辑
- ✅ 修改了 Neo4j 批量写入
- ✅ 需要验证 Batch Layer 覆盖逻辑
- ✅ 测试 Lambda 架构的最终一致性

**输出**:
```
[INFO] Stream transfers found: 90
[INFO] Running Spark batch processor...
[INFO] PostgreSQL Results:
[INFO]   - Stream transfers: 0 (corrected to batch)
[INFO]   - Batch transfers: 90 (source='batch')
[INFO]   - Corrected transfers: 90
[INFO] Neo4j Results:
[INFO]   - Stream TRANSFER relationships: 0
[INFO]   - Batch TRANSFER relationships: 90 (source='batch')
[INFO] ✅ Phase 3 Complete
```

---

## 🔑 关键特性

### 1. 动态 Consumer Group (Phase 2)

Phase 2 使用**动态生成的 consumer group**，每次运行都不同：

```bash
CONSUMER_GROUP="stream-processor-test-$(date +%s)"
# 例如: stream-processor-test-1704240000
```

**优势**:
- ✅ 每次都从 Kafka 开始消费（offset=0）
- ✅ 不影响其他 consumer group
- ✅ 不需要手动管理 offset
- ✅ 可以并行运行多个测试

### 2. 数据源标记

Lambda 架构通过 `source` 字段区分数据来源：

```sql
-- Speed Layer 数据
SELECT * FROM transfers WHERE source = 'stream';

-- Batch Layer 数据
SELECT * FROM transfers WHERE source = 'batch';
```

### 3. 独立清理

- **Phase 2**: 清空 PostgreSQL 和 Neo4j，不影响 Kafka
- **Phase 3**: 读取 stream 数据，覆盖为 batch，不清空数据库

---

## 📝 典型开发流程

### 场景 1: 开发 Flink Speed Layer

```bash
# 1. 首次运行，准备测试数据
make test-integration-phase1

# 2. 修改 Flink 代码
vim processing/stream-processor/src/main/java/...

# 3. 快速测试 Speed Layer（60秒）
make test-integration-phase2

# 4. 继续修改和测试
vim ...
make test-integration-phase2  # 重复运行

# 5. 修改完成，测试完整 Lambda 流程
make test-integration-phase2
make test-integration-phase3
```

### 场景 2: 开发 Spark Batch Layer

```bash
# 1. 确保有测试数据
make test-integration-phase1
make test-integration-phase2  # 生成 stream 数据

# 2. 修改 Spark 代码
vim processing/batch-processor/src/main/java/...

# 3. 快速测试 Batch Layer（30秒）
make test-integration-phase3

# 4. 继续调试
vim ...
make test-integration-phase3  # 重复运行

# 5. 如果需要重新生成 stream 数据
make test-integration-phase2
make test-integration-phase3
```

### 场景 3: 测试 Lambda 架构完整流程

```bash
# 1. 准备数据
make test-integration-phase1

# 2. 测试 Speed Layer
make test-integration-phase2

# 3. 验证 stream 数据
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "SELECT source, COUNT(*) FROM chain_data.transfers GROUP BY source"

# 4. 测试 Batch Layer 覆盖
make test-integration-phase3

# 5. 验证 batch 数据
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "SELECT source, COUNT(*) FROM chain_data.transfers GROUP BY source"
```

---

## ⚙️ 配置选项

### Phase 1 参数

```bash
# 修改起始区块
export START_BLOCK=2000

# 修改区块数量
export NUM_BLOCKS=50

# 运行 Phase 1
./scripts/test-integration-phase1.sh
```

### Phase 2 参数

```bash
# 禁用 Neo4j Sink
export ENABLE_NEO4J_SINK=false

# 禁用 Kafka Producer
export ENABLE_KAFKA_PRODUCER=false

# 运行 Phase 2
./scripts/test-integration-phase2.sh
```

### Phase 3 参数

```bash
# 禁用 Neo4j Sink
export ENABLE_NEO4J_SINK=false

# 指定网络
export NETWORK=ethereum

# 运行 Phase 3
./scripts/test-integration-phase3.sh
```

---

## 🔍 验证和调试

### 查看 Kafka 数据

```bash
# 查看消息数量
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o beginning | wc -l

# 查看最新消息
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o -5
```

### 查看 PostgreSQL 数据

```bash
# 查看数据源分布
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "SELECT source, COUNT(*) FROM chain_data.transfers GROUP BY source"

# 查看 stream 数据
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "SELECT * FROM chain_data.transfers WHERE source='stream' LIMIT 5"

# 查看 batch 数据
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "SELECT * FROM chain_data.transfers WHERE source='batch' LIMIT 5"
```

### 查看 Neo4j 数据

```bash
# 查看数据源分布
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123 \
  "MATCH ()-[r:TRANSFER]->() RETURN r.source as source, count(r) as count"

# 查看 stream 关系
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123 \
  "MATCH ()-[r:TRANSFER {source: 'stream'}]->() RETURN r LIMIT 5"

# 查看 batch 关系
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123 \
  "MATCH ()-[r:TRANSFER {source: 'batch'}]->() RETURN r LIMIT 5"
```

### 手动清理

```bash
# 删除 Kafka topic（重新开始）
kafka-topics.sh --bootstrap-server 100.120.144.128:19092 \
  --delete --topic chain-transactions

# 清理 PostgreSQL
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "TRUNCATE chain_data.transfers CASCADE"

# 清理 Neo4j
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123 \
  "MATCH (n) DETACH DELETE n"
```

---

## 📊 性能对比

| 场景 | 传统方式 | 三阶段方式 | 节省时间 |
|-----|---------|-----------|---------|
| **首次测试** | 180s | 90s + 60s + 30s = 180s | 0% |
| **第2次测试 Phase 2** | 180s | 60s | **67%** |
| **第2次测试 Phase 3** | 180s | 30s | **83%** |
| **第2次测试 Phase 2+3** | 180s | 90s | **50%** |
| **10次测试 Phase 2** | 1800s | 90s + 9×60s = 630s | **65%** |

**结论**: 在开发过程中，平均可以节省 **50-80%** 的测试时间。

---

## 🎯 最佳实践

### 1. 何时运行 Phase 1

- ✅ 每天开始工作时运行一次
- ✅ 修改 data-ingestion 后
- ✅ 需要不同的测试数据时
- ❌ 不要每次测试 Flink/Spark 都运行

### 2. 何时运行 Phase 2

- ✅ 修改 Flink 代码后
- ✅ 调整 Speed Layer 配置后
- ✅ 需要快速验证时
- ✅ 可以连续运行多次

### 3. 何时运行 Phase 3

- ✅ 修改 Spark 代码后
- ✅ 调整 Batch Layer 配置后
- ✅ 验证数据修正逻辑
- ✅ 测试 Lambda 最终一致性

### 4. 何时运行完整测试

- ✅ 提交代码前
- ✅ 重大修改后
- ✅ CI/CD 流水线中
- ✅ 每天结束时验证

---

## 🐛 常见问题

### Q: Phase 2 报错 "No data in Kafka"

**A**: 需要先运行 Phase 1：
```bash
make test-integration-phase1
```

### Q: Phase 3 报错 "No stream data found"

**A**: 需要先运行 Phase 2：
```bash
make test-integration-phase2
```

### Q: Phase 3 没有覆盖数据？

**A**: 检查 Spark 日志：
```bash
tail -f /tmp/spark-batch-processor.log
```

### Q: 每次 Phase 2 都消费相同的数据吗？

**A**: 是的。Phase 2 使用动态 consumer group，每次都从 offset=0 开始消费。

### Q: Phase 3 会清空数据库吗？

**A**: 不会。Phase 3 读取 stream 数据并覆盖为 batch，不清空数据库。

### Q: 可以并行运行多个 Phase 吗？

**A**: 
- Phase 2 可以并行（不同 consumer group）
- Phase 3 不建议并行（会竞争数据库写入）

---

## 📚 相关文档

- [Lambda Architecture Overview](../architecture/LAMBDA_ARCHITECTURE.md)
- [Integration Test README](../../tests/integration/README.md)
- [Phase 1 Summary](./PHASE1_SUMMARY.md)
- [Phase 2 Summary](./PHASE2_SUMMARY.md)

---

## 🎉 总结

三阶段测试方案显著提高了 Lambda 架构的开发效率：

- ✅ **节省时间**: 平均节省 50-80% 的测试时间
- ✅ **提高效率**: 快速迭代 Speed Layer 和 Batch Layer
- ✅ **灵活性**: 可以独立运行任一阶段
- ✅ **安全性**: 使用动态 consumer group，不影响生产
- ✅ **可重复**: Phase 2 和 Phase 3 可以无限次重复运行
- ✅ **完整性**: 覆盖 Lambda 架构的完整流程

**推荐工作流**:
1. 每天开始: 运行 `make test-integration-phase1`
2. 开发 Speed Layer: 多次运行 `make test-integration-phase2`
3. 开发 Batch Layer: 多次运行 `make test-integration-phase3`
4. 提交前: 运行完整测试 Phase 1 + 2 + 3

---

**Last Updated**: 2026-01-03
