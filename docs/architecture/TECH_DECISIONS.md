# Chain Risk Platform - 技术决策记录

> 记录项目中的重要技术决策及其原因

---

## TDR-001: 多语言微服务架构

### 决策
采用多语言微服务架构，而非单一语言技术栈

### 背景
- 项目有双重目标：展示 Crypto 合规能力 + 后端接单技术背书
- 需要展示多种语言的熟练度

### 语言分配

| 服务类型 | 语言选择           | 原因                           |
| -------- | ------------------ | ------------------------------ |
| 数据采集 | Go                 | 高并发、低资源占用             |
| 流处理   | Java/Flink         | 生态成熟、与工作经验一致       |
| 批处理   | Scala/Spark        | 大数据处理标准、生态丰富       |
| 查询服务 | Go/Gin             | 高性能、快速开发               |
| 风险服务 | Python/FastAPI     | ML 生态、快速迭代              |
| 图分析   | Java/Spring+Neo4j  | 企业级方案、图数据库集成好     |
| 服务治理 | Java/Spring Cloud  | 企业级方案、功能完善           |
| BFF      | TypeScript/Nest.js | 前后端类型一致、GraphQL 支持好 |
| 前端     | React/TypeScript   | 生态丰富、类型安全             |

### 影响
- 增加了运维复杂度
- 需要统一的服务通信规范
- 需要完善的 CI/CD 支持

---

## TDR-002: 数据存储选型

### 决策
- 关系型数据：PostgreSQL
- 图数据：Neo4j
- 缓存：Redis
- 消息队列：Kafka

### 原因

#### PostgreSQL
- 开源、功能强大
- JSON 支持好，适合半结构化数据
- 扩展性好 (TimescaleDB, PostGIS)
- 支持 UPSERT（流批覆盖场景）

#### Neo4j
- 图查询性能优秀
- Cypher 查询语言直观
- 适合地址关系和 Tag Propagation
- 支持 MERGE 操作（流批覆盖场景）

#### Redis
- 高性能缓存
- 支持多种数据结构
- 可用于分布式锁、限流

#### Kafka
- 高吞吐量
- 持久化消息
- 与 Flink/Spark 集成好
- 支持流批一体架构

---

## TDR-003: API 设计规范

### 决策
- 内部服务间：gRPC
- 对外 API：RESTful + OpenAPI
- BFF 层：可选 GraphQL

### 原因
- gRPC：高性能、强类型、代码生成
- REST：通用性好、调试方便
- GraphQL：前端灵活查询、减少请求次数

### 规范
```yaml
# RESTful API 命名规范
GET    /api/v1/addresses/:address        # 获取地址详情
GET    /api/v1/addresses/:address/transfers  # 获取地址交易
POST   /api/v1/risk/score                # 计算风险分
GET    /api/v1/alerts                    # 获取告警列表
```

---

## TDR-004: 服务治理方案

### 决策
使用 Spring Cloud 生态作为服务治理基础

### 组件选择

| 功能     | 组件                 | 备选                        |
| -------- | -------------------- | --------------------------- |
| 服务注册 | Nacos                | Consul, Eureka              |
| 配置中心 | Nacos                | Apollo, Spring Cloud Config |
| 网关     | Spring Cloud Gateway | Kong, APISIX                |
| 链路追踪 | Jaeger               | Zipkin, SkyWalking          |
| 监控     | Prometheus + Grafana | -                           |

### 原因
- Nacos：阿里开源，功能全面，中文文档好
- 与 Java 生态集成好
- 支持多语言 SDK

---

## TDR-005: 风险评分方案

### 决策
分阶段实现：规则引擎 → ML 模型

### Phase 1: 规则引擎
```python
# 基础规则示例
rules = [
    BlacklistRule(weight=1.0),      # 黑名单检查
    HighFrequencyRule(weight=0.3),  # 高频交易
    LargeAmountRule(weight=0.4),    # 大额交易
    MixerInteractionRule(weight=0.8) # 混币器交互
]
```

### Phase 2: ML 模型
- 特征：交易图特征、时序特征、行为特征
- 模型：XGBoost → GNN
- 服务：模型版本管理、A/B 测试

### 原因
- 规则引擎快速上线，可解释性强
- ML 模型提升准确率，但需要数据积累

---

## TDR-006: Tag Propagation 算法

### 决策
基于图的标签传播算法，带置信度衰减

### 算法设计
```
初始标签: 已知风险地址标记为 1.0
传播规则:
  - 直接交易: 置信度 × 0.8
  - 二度关联: 置信度 × 0.6
  - 三度关联: 置信度 × 0.4
  - 超过三度: 不传播

聚合规则:
  - 多个来源取最大值
  - 或加权平均
```

### 实现方式
- 使用 Neo4j 存储图结构
- Cypher 查询实现传播
- 增量传播（Kafka 触发）+ 批量传播（定时任务）

---

## TDR-007: Lambda 架构 - 流批一体处理（重要更新）

### 决策
采用 **Lambda 架构**，实现流批分离、职责明确

- **实时流**：Flink DataStream 双写 PostgreSQL + Neo4j
- **批处理**：Spark 每日覆盖修正流处理数据
- **图分析**：Graph Engine 基于 Neo4j 进行增量 + 批量分析

### 背景
传统方案存在的问题：
1. Graph Engine 定时从 PostgreSQL 同步数据到 Neo4j，延迟 5 分钟
2. 重复计算：Flink 写 PostgreSQL，Graph Engine 再读取重建图
3. 资源浪费：批量同步产生大量数据库查询
4. 实时性差：图分析结果需要等待同步完成

### 架构设计

#### 数据流
```
┌─────────────────────────────────────────────────────────────┐
│                    实时流（Flink Stream）                    │
│                                                              │
│  链上数据 → Kafka (raw-blocks)                               │
│                ↓                                             │
│          Flink Stream Processor                              │
│                ↓                                             │
│      ┌─────────┴─────────┐                                   │
│      ↓                   ↓                                   │
│  PostgreSQL          Neo4j                                   │
│  (source='stream')   (source='stream')                       │
│      ↓                   ↓                                   │
│  Query Service      Graph Engine (增量分析)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   批处理流（Spark Batch）                    │
│                                                              │
│  全节点 RPC (重新扫描昨天区块)                               │
│                ↓                                             │
│          Spark Batch Processor                               │
│                ↓                                             │
│      ┌─────────┴─────────┐                                   │
│      ↓                   ↓                                   │
│  PostgreSQL          Neo4j                                   │
│  (source='batch')    (source='batch')                        │
│  覆盖 stream 数据    覆盖 stream 数据                        │
│      ↓                   ↓                                   │
│  Query Service      Graph Engine (批量分析)                  │
└─────────────────────────────────────────────────────────────┘
```

#### 职责分配

| 组件 | 职责 | 输入 | 输出 |
|-----|------|------|------|
| **Flink Stream** | 实时流处理 | Kafka `raw-blocks` | PostgreSQL + Neo4j (source='stream') |
| **Spark Batch** | 批处理覆盖 | 全节点 RPC | PostgreSQL + Neo4j (source='batch', 覆盖) |
| **Graph Engine** | 图分析服务 | Neo4j 图数据 | 聚类结果、标签传播、图查询 API |

### 核心改动

#### 1. Flink Stream Processor
```java
// 双写策略
DataStream<Transfer> transfers = ...;

// 写入 PostgreSQL
transfers.addSink(JdbcSink.sink(
    "INSERT INTO transfers (...) VALUES (...) " +
    "ON CONFLICT (tx_hash) DO UPDATE SET source='stream'",
    ...
));

// 写入 Neo4j
transfers.addSink(new Neo4jSink<Transfer>() {
    @Override
    public void invoke(Transfer t, Context context) {
        session.run(
            "MERGE (from:Address {address: $from}) " +
            "MERGE (to:Address {address: $to}) " +
            "MERGE (from)-[r:TRANSFER {tx_hash: $txHash}]->(to) " +
            "ON CREATE SET r.source = 'stream', r.timestamp = $timestamp",
            parameters(...)
        );
    }
});
```

#### 2. Spark Batch Processor
```scala
// 覆盖策略
val transfers = spark.read
    .format("web3")
    .option("rpcUrl", "https://eth-mainnet.g.alchemy.com/v2/...")
    .load()

// 覆盖写入 PostgreSQL
transfers.write
    .format("jdbc")
    .option("conflictAction", "DO UPDATE SET source='batch', corrected_at=NOW()")
    .save()

// 覆盖写入 Neo4j
transfers.foreachPartition { partition =>
    session.run(
        "MERGE (from:Address {address: $from}) " +
        "MERGE (to:Address {address: $to}) " +
        "MERGE (from)-[r:TRANSFER {tx_hash: $txHash}]->(to) " +
        "ON MATCH SET r.source = 'batch', r.corrected_at = timestamp()",
        parameters(...)
    )
}
```

#### 3. Graph Engine
```java
// ❌ 移除：定时从 PostgreSQL 同步的逻辑
// @Scheduled(fixedDelayString = "${graph.sync.interval:300000}")
// public int syncTransfers() { ... }

// ✅ 新增：增量图分析（Kafka 触发）
@KafkaListener(topics = "transfers", groupId = "graph-engine")
public void onNewTransfer(Transfer transfer) {
    // 增量聚类
    if (shouldTriggerClustering(transfer)) {
        clusteringService.runIncrementalClustering(
            transfer.getFromAddr(), 
            transfer.getToAddr()
        );
    }
    
    // 增量标签传播
    if (isHighRiskAddress(transfer.getFromAddr())) {
        tagPropagationService.propagateFromAddress(transfer.getFromAddr());
    }
}

// ✅ 保留：批量图分析（定时任务）
@Scheduled(cron = "0 0 3 * * ?") // 每天凌晨 3 点
public ClusteringResultResponse runClustering() {
    // 全图聚类、PageRank、社区发现
    ...
}
```

### 优势对比

| 维度 | 传统架构 | Lambda 架构（本项目） |
|-----|---------|---------------------|
| **Neo4j 数据延迟** | 5 分钟（定时同步） | 秒级（Flink 直接写入） |
| **PostgreSQL 压力** | 高（Graph Engine 频繁查询） | 低（只用于 Query Service） |
| **图分析实时性** | 差（需等待同步） | 好（增量分析 + 批量分析） |
| **数据一致性** | 弱（同步可能失败） | 强（Spark 批处理覆盖） |
| **资源利用率** | 低（重复计算） | 高（流批分离，各司其职） |

### 应用场景

#### 场景 1: Transfer 数据提取与修正
- **Flink 流处理**: 快速解析，可能有错（数据丢失、解析失败、区块重组）
- **Spark 批处理**: 精确解析，处理复杂合约、等待区块确认

#### 场景 2: 地址风险评分
- **Flink 流处理**: 简单规则（黑名单检查），秒级响应
- **Spark 批处理**: 复杂 ML 模型，全局特征（过去 30 天交易模式）

#### 场景 3: 地址聚类与标签传播
- **Graph Engine 增量**: 局部子图分析，实时响应
- **Graph Engine 批量**: 全图算法（PageRank、Louvain），每日运行

### 技术栈一致性
- 与工作经验一致（Flink + Spark）
- Java/Scala 技术栈统一
- 批处理保证数据最终一致性
- 图分析实时性提升（从 5 分钟延迟到秒级）

### 日期
2026-01-03

---

## TDR-008: 部署方案

### 决策
- 开发环境：Docker Compose
- 生产环境：Kubernetes

### K8s 资源规划
```yaml
# 初始资源配置
services:
  orchestrator:     { replicas: 2, cpu: 500m, memory: 512Mi }
  bff:              { replicas: 2, cpu: 500m, memory: 512Mi }
  query-service:    { replicas: 2, cpu: 500m, memory: 512Mi }
  risk-ml-service:  { replicas: 2, cpu: 1000m, memory: 1Gi }
  alert-service:    { replicas: 2, cpu: 500m, memory: 512Mi }
  
processing:
  stream-processor: { replicas: 1, cpu: 2000m, memory: 4Gi }
  batch-processor:  { replicas: 1, cpu: 4000m, memory: 8Gi }
  graph-engine:     { replicas: 2, cpu: 1000m, memory: 2Gi }
  
databases:
  postgresql:       { replicas: 1, cpu: 1000m, memory: 2Gi }
  neo4j:            { replicas: 1, cpu: 2000m, memory: 4Gi }
  redis:            { replicas: 1, cpu: 500m, memory: 1Gi }
  kafka:            { replicas: 3, cpu: 1000m, memory: 2Gi }
```

---

## 📝 决策模板

```markdown
## TDR-XXX: [决策标题]

### 决策
[简要描述决策内容]

### 背景
[为什么需要做这个决策]

### 选项
1. 选项A: ...
2. 选项B: ...
3. 选项C: ...

### 决策原因
[为什么选择这个方案]

### 影响
[这个决策带来的影响]

### 日期
[决策日期]
```

---

**最后更新**: 2026-01-03
