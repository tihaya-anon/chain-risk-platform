# 架构变更日志 - Lambda 架构重构

> 记录 2026-01-03 的 Lambda 架构重构变更

---

## 📅 变更日期

2026-01-03

---

## 🎯 变更概述

将项目架构从"传统流批处理"升级为"Lambda 架构"，实现流批分离、职责明确，提升系统的实时性和准确性。

---

## 📝 变更详情

### 1. 新增文档

#### 📄 `docs/architecture/LAMBDA_ARCHITECTURE.md`
**内容**:
- Lambda 架构的核心概念（Speed Layer、Batch Layer、Serving Layer）
- 三层架构详解（Flink 流处理、Spark 批处理、微服务层）
- 完整的代码实现示例
- 数据表设计（PostgreSQL + Neo4j）
- 应用场景对比（Transfer 提取、风险评分、地址聚类）
- 监控指标与数据质量保证

**目的**: 提供 Lambda 架构的完整实现指南

---

### 2. 更新文档

#### 📄 `docs/architecture/PROJECT_OVERVIEW.md`
**主要变更**:
- ✅ 架构图更新为 Lambda 架构
- ✅ 新增"数据流详解"章节
  - 实时流处理（Flink Stream）
  - 批处理覆盖（Spark Batch）
  - 图分析服务（Graph Engine）
- ✅ 新增"Lambda 架构优势"对比表
- ✅ 新增"应用场景示例"（Transfer 提取、风险评分、地址聚类）
- ✅ 更新项目结构说明

**影响**: 项目架构说明更加清晰，职责分工明确

---

#### 📄 `docs/architecture/TECH_DECISIONS.md`
**主要变更**:
- ✅ TDR-001 更新：新增 Scala/Spark 和 Graph Engine 的语言分配
- ✅ TDR-002 更新：补充 PostgreSQL 和 Neo4j 支持 UPSERT/MERGE（流批覆盖场景）
- ✅ **TDR-007 重大更新**：从"流批一体处理"改为"Lambda 架构"
  - 详细说明传统架构的问题
  - 提供完整的架构设计和数据流
  - 明确 Flink、Spark、Graph Engine 的职责分配
  - 提供核心代码示例
  - 对比传统架构与 Lambda 架构的优势
  - 列举三大应用场景（Transfer 提取、风险评分、地址聚类）
- ✅ TDR-008 更新：新增 batch-processor 和 graph-engine 的资源规划

**影响**: 技术决策更加完善，为后续实现提供指导

---

#### 📄 `README.md`
**主要变更**:
- ✅ 标题更新为"Lambda 架构"
- ✅ 新增 Scala 徽章
- ✅ 项目简介强调"Lambda 架构"
- ✅ 架构图更新（三层结构：Speed、Batch、Serving）
- ✅ 技术栈新增 Scala/Spark
- ✅ 项目结构更新（明确 Speed Layer 和 Batch Layer）
- ✅ 新增"核心特性"章节
  - Lambda 架构对比表
  - 图分析（增量 + 批量）
  - 数据质量保证
- ✅ 新增"监控与数据质量"章节
- ✅ Roadmap 更新（新增 Lambda 架构相关任务）

**影响**: 主页更加专业，突出 Lambda 架构特色

---

#### 📄 `docs/README.md`
**主要变更**:
- ✅ 架构设计章节新增 [Lambda 架构详解](./architecture/LAMBDA_ARCHITECTURE.md)
- ✅ 快速开始章节新增 Lambda 架构阅读指引
- ✅ 目录结构更新（标注新增文档）
- ✅ 新增"文档更新亮点"章节（记录 2026-01-03 的变更）

**影响**: 文档导航更加完善

---

## 🏗️ 架构变更对比

### 传统架构（变更前）

```
Flink Stream → PostgreSQL → Graph Engine (定时同步) → Neo4j
                                ↓
                          Query Service
```

**问题**:
1. Graph Engine 每 5 分钟从 PostgreSQL 同步数据到 Neo4j，延迟高
2. 重复计算：Flink 写 PostgreSQL，Graph Engine 再读取重建图
3. 资源浪费：批量同步产生大量数据库查询
4. 实时性差：图分析结果需要等待同步完成

---

### Lambda 架构（变更后）

```
┌─────────────────────────────────────────────────────────┐
│                    Speed Layer                          │
│  Kafka → Flink Stream ──┬─→ PostgreSQL (source='stream')│
│                         └─→ Neo4j (source='stream')     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Batch Layer                          │
│  全节点 RPC → Spark Batch ──┬─→ PostgreSQL (覆盖)       │
│                             └─→ Neo4j (覆盖)            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Serving Layer                         │
│  Query Service + Risk Service + Graph Engine            │
│  (增量分析 + 批量分析)                                   │
└─────────────────────────────────────────────────────────┘
```

**优势**:
1. ✅ **实时性提升**: Flink 直接写入 Neo4j，Graph Engine 秒级响应
2. ✅ **准确性提升**: Spark 批处理覆盖修正错误数据
3. ✅ **资源优化**: 减少 PostgreSQL 查询压力，无重复计算
4. ✅ **职责清晰**: 流批分离，Graph Engine 无需同步数据

---

## 🔧 核心改动

### 1. Flink Stream Processor

**变更前**:
```java
// 单写 PostgreSQL
transfers.addSink(JdbcSink.sink(...));
```

**变更后**:
```java
// 双写策略
transfers.addSink(JdbcSink.sink(...));  // PostgreSQL
transfers.addSink(new Neo4jSink<>(...)); // Neo4j
transfers.addSink(new FlinkKafkaProducer<>("transfers", ...)); // Kafka
```

---

### 2. Spark Batch Processor（新增）

**功能**:
- 从全节点 RPC 重新扫描昨天的区块
- 使用完整的解析逻辑（处理复杂合约、重组）
- 覆盖写入 PostgreSQL + Neo4j（标记 `source='batch'`）

**调度**:
- 每日凌晨 2 点运行（Airflow DAG）

---

### 3. Graph Engine

**变更前**:
```java
// 定时从 PostgreSQL 同步
@Scheduled(fixedDelayString = "${graph.sync.interval:300000}")
public int syncTransfers() {
    // 从 PostgreSQL 读取 → 写入 Neo4j
    ...
}
```

**变更后**:
```java
// ❌ 移除定时同步逻辑

// ✅ 新增增量分析（Kafka 触发）
@KafkaListener(topics = "transfers", groupId = "graph-engine")
public void onNewTransfer(Transfer transfer) {
    // 增量聚类、增量标签传播
    ...
}

// ✅ 保留批量分析（定时任务）
@Scheduled(cron = "0 0 3 * * ?")
public void runBatchAnalysis() {
    // 全图聚类、PageRank、社区发现
    ...
}
```

---

## 📊 数据表设计

### PostgreSQL

```sql
CREATE TABLE transfers (
    tx_hash VARCHAR(66) PRIMARY KEY,
    ...
    source VARCHAR(10) NOT NULL,  -- 'stream' 或 'batch'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    corrected_at TIMESTAMP,  -- 批处理覆盖时间
    ...
);
```

### Neo4j

```cypher
CREATE (a:Address {
    address: '0x123...',
    source: 'stream',  -- 'stream' 或 'batch'
    corrected_at: timestamp()
})

CREATE (from)-[r:TRANSFER {
    tx_hash: '0xabc...',
    source: 'stream',  -- 'stream' 或 'batch'
    corrected_at: timestamp()
}]->(to)
```

---

## 🎯 应用场景

### 场景 1: Transfer 数据提取与修正

| 阶段 | 处理方式 | 数据源 | 准确性 | 实时性 |
|-----|---------|-------|-------|-------|
| **实时** | Flink 流处理 | Kafka | 中等 | 秒级 |
| **修正** | Spark 批处理 | 全节点 RPC | 高 | T+1 天 |

**覆盖原因**: 流处理可能丢失数据、解析错误、区块重组

---

### 场景 2: 地址风险评分

| 阶段 | 处理方式 | 特征工程 | 模型复杂度 | 实时性 |
|-----|---------|---------|-----------|-------|
| **实时** | Flink 流处理 | 简单窗口特征 | 轻量规则 | 秒级 |
| **修正** | Spark 批处理 | 全局历史特征 | 复杂 ML 模型 | T+1 天 |

**覆盖原因**: 批处理可以计算全局特征、使用复杂模型

---

### 场景 3: 地址聚类与标签传播

| 阶段 | 处理方式 | 分析范围 | 算法复杂度 | 实时性 |
|-----|---------|---------|-----------|-------|
| **实时** | Graph Engine 增量 | 局部子图 | 简单聚类 | 秒级 |
| **修正** | Graph Engine 批量 | 全图 | PageRank、Louvain | 每日 |

**覆盖原因**: 批量分析可以运行复杂图算法、获得全局视图

---

## 📈 监控指标

### 新增监控

```yaml
metrics:
  # 流处理指标
  flink_stream:
    - neo4j_write_latency: Neo4j 写入延迟
    - dual_write_success_rate: 双写成功率
    
  # 批处理指标
  spark_batch:
    - correction_count: 修正记录数
    - correction_rate: 修正率
    
  # 图分析指标
  graph_engine:
    - incremental_analysis_latency: 增量分析延迟
    - batch_analysis_duration: 批量分析时长
```

---

## 🚀 后续任务

### Phase 4: Spark 批处理实现
- [ ] 实现 TransferCorrectionJob（Scala）
- [ ] 实现 RiskScoringBatchJob（Python）
- [ ] 配置 Airflow DAG（每日调度）
- [ ] 集成测试（流批数据一致性）

### Phase 5: Graph Engine 优化
- [ ] 实现 Kafka 监听器（增量分析）
- [ ] 移除 PostgreSQL 同步逻辑
- [ ] 实现批量图分析（PageRank、Louvain）
- [ ] 性能测试（增量 vs 批量）

### Phase 6: 监控与告警
- [ ] 配置 Prometheus + Grafana
- [ ] 实现数据质量监控（流批差异率）
- [ ] 实现告警规则（修正率异常）

---

## 📚 相关文档

- [Lambda 架构详解](./architecture/LAMBDA_ARCHITECTURE.md)
- [项目总览](./architecture/PROJECT_OVERVIEW.md)
- [技术决策记录](./architecture/TECH_DECISIONS.md)

---

## 👥 变更人员

- 架构设计: @user
- 文档编写: @user
- 审核人员: 待定

---

**变更日期**: 2026-01-03
