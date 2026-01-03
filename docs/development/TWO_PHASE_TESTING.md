# Two-Phase Integration Testing

> 将集成测试分为两个独立阶段，提高开发效率

**Date**: 2026-01-03  
**Branch**: `feature/lambda-architecture-implementation`

---

## 🎯 目标

在开发过程中，data-ingestion 的修改频率较低，而 Flink stream-processor 的修改频率较高。将集成测试分为两个阶段可以：

1. **减少测试时间**: Phase 2 可以重复运行，无需重新采集数据
2. **提高开发效率**: 快速验证 Flink 代码改动
3. **节省资源**: 避免重复启动 mock server 和 data-ingestion

---

## 📊 测试架构

### 传统方式（单阶段）
```
每次测试都要运行:
Mock Server → data-ingestion → Kafka → Flink → PostgreSQL + Neo4j
   (30s)         (60s)                    (60s)
                                          
总时间: ~150 秒
```

### 新方式（两阶段）
```
Phase 1 (一次性运行):
Mock Server → data-ingestion → Kafka
   (30s)         (60s)
                                          
总时间: ~90 秒

Phase 2 (可重复运行):
Kafka → Flink → PostgreSQL + Neo4j
         (60s)
                                          
总时间: ~60 秒
```

**效率提升**: 第二次及以后的测试时间从 150 秒减少到 60 秒（**节省 60%**）

---

## 🚀 使用方法

### 完整测试（首次运行）

```bash
# 运行完整测试（Phase 1 + Phase 2）
make test-integration
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
[INFO] You can run Phase 2 multiple times without re-running Phase 1
```

### Phase 2: Flink 处理数据

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
- ✅ 需要快速验证改动

**输出**:
```
[INFO] Consumer Group: stream-processor-test-1704240000 (dynamic)
[INFO] ✅ Phase 2 Complete
[INFO] This group will not interfere with production consumers
[INFO] To run again: ./scripts/test-integration-phase2.sh
```

---

## 🔑 关键特性

### 1. 动态 Consumer Group

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

### 2. 数据持久化

Phase 1 的数据保留在 Kafka 中，直到：
- 手动删除 topic
- Kafka retention policy 过期
- 重新运行 Phase 1

### 3. 独立清理

Phase 2 每次运行前会清理数据库：
- ✅ 清空 PostgreSQL 测试表
- ✅ 清空 Neo4j 测试数据
- ✅ 不影响 Kafka 数据

---

## 📝 典型开发流程

### 场景 1: 开发 Flink 新功能

```bash
# 1. 首次运行，准备测试数据
make test-integration-phase1

# 2. 修改 Flink 代码
vim processing/stream-processor/src/main/java/...

# 3. 快速测试（60秒）
make test-integration-phase2

# 4. 继续修改和测试
vim ...
make test-integration-phase2  # 重复运行

# 5. 修改完成，运行完整测试
make test-integration
```

### 场景 2: 调试 Neo4j Sink

```bash
# 1. 确保有测试数据
make test-integration-phase1

# 2. 修改 Neo4j Sink 代码
vim processing/stream-processor/src/main/java/com/chainrisk/stream/sink/Neo4jTransferSink.java

# 3. 测试（60秒）
make test-integration-phase2

# 4. 查看 Neo4j 数据
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123
> MATCH (a:Address) RETURN count(a);

# 5. 继续调试
make test-integration-phase2
```

### 场景 3: 修改测试数据

```bash
# 1. 修改测试参数
export NUM_BLOCKS=50  # 增加到 50 个区块

# 2. 重新采集数据
make test-integration-phase1

# 3. 测试 Flink
make test-integration-phase2
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

---

## 🔍 验证和调试

### 查看 Kafka 数据

```bash
# 查看消息数量
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o beginning | wc -l

# 查看最新消息
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o -5

# 查看特定 offset
kcat -b 100.120.144.128:19092 -t chain-transactions -C -e -o 100 -c 5
```

### 查看 Consumer Groups

```bash
# 列出所有 consumer groups
kafka-consumer-groups.sh --bootstrap-server 100.120.144.128:19092 --list

# 查看特定 group 的 offset
kafka-consumer-groups.sh --bootstrap-server 100.120.144.128:19092 \
  --group stream-processor-test-1704240000 --describe
```

### 手动清理

```bash
# 删除 Kafka topic（重新开始）
kafka-topics.sh --bootstrap-server 100.120.144.128:19092 \
  --delete --topic chain-transactions

# 清理数据库
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "TRUNCATE chain_data.transfers CASCADE"

# 清理 Neo4j
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123 \
  "MATCH (n) DETACH DELETE n"
```

---

## 📊 性能对比

| 场景 | 传统方式 | 新方式 | 节省时间 |
|-----|---------|--------|---------|
| **首次测试** | 150s | 90s (Phase 1) + 60s (Phase 2) = 150s | 0% |
| **第2次测试** | 150s | 60s (Phase 2) | **60%** |
| **第3次测试** | 150s | 60s (Phase 2) | **60%** |
| **10次测试** | 1500s | 150s + 9×60s = 690s | **54%** |

**结论**: 在开发过程中，平均可以节省 **50-60%** 的测试时间。

---

## 🎯 最佳实践

### 1. 何时运行 Phase 1

- ✅ 每天开始工作时运行一次
- ✅ 修改 data-ingestion 后
- ✅ 需要不同的测试数据时
- ❌ 不要每次测试 Flink 都运行

### 2. 何时运行 Phase 2

- ✅ 修改 Flink 代码后
- ✅ 调整配置参数后
- ✅ 需要快速验证时
- ✅ 可以连续运行多次

### 3. 何时运行完整测试

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

### Q: 每次 Phase 2 都消费相同的数据吗？

**A**: 是的。Phase 2 使用动态 consumer group，每次都从 offset=0 开始消费。

### Q: 会不会影响生产环境的 consumer？

**A**: 不会。Phase 2 使用独立的 consumer group（`stream-processor-test-*`），不会影响生产 consumer group（`stream-processor`）。

### Q: Kafka 数据会保留多久？

**A**: 根据 Kafka 的 retention policy，默认 7 天。可以手动删除 topic 重新开始。

### Q: 可以并行运行多个 Phase 2 吗？

**A**: 可以，每次运行使用不同的 consumer group，互不干扰。但注意数据库清理可能冲突。

---

## 📚 相关文档

- [Integration Test README](../../tests/integration/README.md)
- [Integration Test Troubleshooting](./INTEGRATION_TEST_TROUBLESHOOTING.md)
- [Phase 1 Summary](./PHASE1_SUMMARY.md)

---

## 🎉 总结

两阶段测试方案显著提高了开发效率：

- ✅ **节省时间**: 平均节省 50-60% 的测试时间
- ✅ **提高效率**: 快速迭代 Flink 代码
- ✅ **灵活性**: 可以独立运行任一阶段
- ✅ **安全性**: 使用动态 consumer group，不影响生产
- ✅ **可重复**: Phase 2 可以无限次重复运行

**推荐工作流**:
1. 每天开始: 运行 `make test-integration-phase1`
2. 开发过程: 多次运行 `make test-integration-phase2`
3. 提交前: 运行 `make test-integration`

---

**Last Updated**: 2026-01-03
