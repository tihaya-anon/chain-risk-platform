# Lambda 架构详解 - 流批一体处理

> Chain Risk Platform 的 Lambda 架构设计与实现

---

## 📖 什么是 Lambda 架构

Lambda 架构是一种大数据处理架构，通过结合**批处理**和**流处理**来实现：
- **实时性**：流处理提供秒级响应
- **准确性**：批处理保证数据最终一致性

### 核心思想
```
原始数据 → 批处理层（准确但慢）→ 批视图
         ↓
         流处理层（快速但可能有错）→ 实时视图
         ↓
         服务层（合并批视图 + 实时视图）→ 查询结果
```

---

## 🏗️ 本项目的 Lambda 架构

### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                    Data Ingestion Layer                      │
│                  链上数据采集 (Go)                           │
│                           ↓                                  │
│                    Kafka Topics                              │
│                  - raw-blocks                                │
│                  - transfers                                 │
└────────────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│  Speed Layer     │      │  Batch Layer     │
│  (实时流处理)    │      │  (批处理覆盖)    │
│                  │      │                  │
│  Flink Stream    │      │  Spark Batch     │
│                  │      │                  │
│  - 快速解析      │      │  - 完整解析      │
│  - 双写数据库    │      │  - 覆盖修正      │
│  - 简单规则      │      │  - 复杂模型      │
└────┬─────────┬───┘      └────┬─────────┬───┘
     │         │               │         │
     │         └───────┐   ┌───┘         │
     │                 │   │             │
     ▼                 ▼   ▼             ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │    Neo4j     │  │ Graph Engine │
│              │  │              │  │              │
│ source:      │  │ source:      │  │ - 增量分析   │
│ stream/batch │  │ stream/batch │  │ - 批量分析   │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  Serving Layer   │
                │  (服务层)        │
                │                  │
                │  - Query Service │
                │  - Risk Service  │
                │  - Alert Service │
                └──────────────────┘
```

---

## 🔄 三层架构详解

### 1️⃣ Speed Layer（实时流处理层）

#### 职责
提供**秒级**数据处理，快速响应用户查询

#### 技术栈
- **Flink Stream Processor** (Java)
- **Kafka** (消息队列)

#### 数据流
```
Kafka (raw-blocks)
    ↓
Flink Stream Processor
    ├─ 解析 Transfer (Native + ERC20)
    ├─ 简单数据验证
    └─ 实时风险规则（黑名单检查）
    ↓
双写策略
├─ PostgreSQL (source='stream')
│   └─ 用于 Query Service OLTP 查询
│
└─ Neo4j (source='stream')
    └─ 用于 Graph Engine 实时图分析
    ↓
发送到 Kafka (transfers)
    └─ 触发 Graph Engine 增量分析
```

#### 实现示例

```java processing/stream-processor/src/main/java/com/chainrisk/stream/job/TransferExtractionJob.java
public class TransferExtractionJob {
    public void execute() {
        // 1. 消费 Kafka
        DataStream<RawBlockData> blockStream = env
            .addSource(new FlinkKafkaConsumer<>("raw-blocks", ...))
            .uid("kafka-source");
        
        // 2. 解析 Transfer
        DataStream<Transfer> transfers = blockStream
            .flatMap(new TransferParser())  // 快速解析
            .uid("transfer-parser");
        
        // 3. 双写 PostgreSQL
        transfers.addSink(JdbcSink.sink(
            "INSERT INTO transfers (...) VALUES (...) " +
            "ON CONFLICT (tx_hash) DO UPDATE SET " +
            "  source = 'stream', " +
            "  updated_at = NOW()",
            ...
        )).uid("postgres-sink");
        
        // 4. 双写 Neo4j
        transfers.addSink(new Neo4jSink<Transfer>() {
            @Override
            public void invoke(Transfer t, Context context) {
                try (Session session = driver.session()) {
                    session.run(
                        "MERGE (from:Address {address: $from, network: $network}) " +
                        "ON CREATE SET from.first_seen = timestamp(), " +
                        "              from.risk_score = 0.0, " +
                        "              from.source = 'stream' " +
                        "MERGE (to:Address {address: $to, network: $network}) " +
                        "ON CREATE SET to.first_seen = timestamp(), " +
                        "              to.risk_score = 0.0, " +
                        "              to.source = 'stream' " +
                        "MERGE (from)-[r:TRANSFER {tx_hash: $txHash}]->(to) " +
                        "ON CREATE SET r.amount = $amount, " +
                        "              r.timestamp = $timestamp, " +
                        "              r.source = 'stream'",
                        parameters(...)
                    );
                }
            }
        }).uid("neo4j-sink");
        
        // 5. 发送到 Kafka 触发下游
        transfers.addSink(new FlinkKafkaProducer<>("transfers", ...))
            .uid("kafka-producer");
    }
}
```

#### 特点
- ✅ **实时性好**：秒级延迟
- ✅ **吞吐量高**：可处理高频交易
- ⚠️ **可能有错**：数据丢失、解析失败、区块重组
- ⚠️ **简单规则**：无法运行复杂 ML 模型

---

### 2️⃣ Batch Layer（批处理层）

#### 职责
提供**准确**的数据处理，覆盖修正流处理的错误

#### 技术栈
- **Spark Batch Processor** (Scala)
- **全节点 RPC** (数据源)

#### 数据流
```
全节点 RPC (重新扫描昨天的区块)
    ↓
Spark Batch Processor
    ├─ 完整解析逻辑（处理复杂合约）
    ├─ 等待区块确认（避免重组）
    ├─ 新合约类型支持
    └─ 全局特征计算
    ↓
覆盖写入策略
├─ PostgreSQL (source='batch', 覆盖 stream)
│   └─ ON CONFLICT DO UPDATE SET source='batch', corrected_at=NOW()
│
└─ Neo4j (source='batch', 覆盖 stream)
    └─ ON MATCH SET source='batch', corrected_at=timestamp()
    ↓
触发 Graph Engine 批量分析
    └─ 全图聚类、PageRank、社区发现
```

#### 实现示例

```scala processing/batch-processor/src/main/scala/TransferCorrectionJob.scala
object TransferCorrectionJob {
    def main(args: Array[String]): Unit = {
        val spark = SparkSession.builder()
            .appName("Transfer Correction")
            .getOrCreate()
        
        // 1. 从全节点重新获取昨天的区块
        val blocks = spark.read
            .format("web3")  // 自定义 DataSource
            .option("rpcUrl", "https://eth-mainnet.g.alchemy.com/v2/...")
            .option("startBlock", yesterdayStart)
            .option("endBlock", yesterdayEnd)
            .option("confirmations", 12)  // 等待 12 个确认
            .load()
        
        // 2. 完整解析逻辑
        val transfers = blocks
            .flatMap(parseTransfersWithFullLogic)  // 处理复杂合约
            .withColumn("source", lit("batch"))
            .withColumn("corrected_at", current_timestamp())
        
        // 3. 覆盖写入 PostgreSQL
        transfers.write
            .format("jdbc")
            .option("url", "jdbc:postgresql://...")
            .option("dbtable", "transfers")
            .option("conflictAction", 
                "ON CONFLICT (tx_hash) DO UPDATE SET " +
                "  from_addr = EXCLUDED.from_addr, " +
                "  to_addr = EXCLUDED.to_addr, " +
                "  amount = EXCLUDED.amount, " +
                "  source = 'batch', " +
                "  corrected_at = NOW()")
            .mode("append")
            .save()
        
        // 4. 覆盖写入 Neo4j
        transfers.foreachPartition { partition =>
            val driver = GraphDatabase.driver("bolt://neo4j:7687", ...)
            val session = driver.session()
            
            partition.foreach { row =>
                session.run(
                    "MERGE (from:Address {address: $from}) " +
                    "ON MATCH SET from.source = 'batch', " +
                    "             from.corrected_at = timestamp() " +
                    "MERGE (to:Address {address: $to}) " +
                    "ON MATCH SET to.source = 'batch', " +
                    "             to.corrected_at = timestamp() " +
                    "MERGE (from)-[r:TRANSFER {tx_hash: $txHash}]->(to) " +
                    "ON MATCH SET r.source = 'batch', " +
                    "             r.corrected_at = timestamp()",
                    parameters(...)
                )
            }
            
            session.close()
            driver.close()
        }
        
        // 5. 触发 Graph Engine 批量分析
        triggerGraphAnalysis()
    }
}
```

#### 调度方案

```yaml
# Airflow DAG
dag:
  name: daily_batch_correction
  schedule: "0 2 * * *"  # 每天凌晨 2 点
  
  tasks:
    - name: transfer_correction
      type: spark_submit
      script: TransferCorrectionJob.scala
      resources:
        executor_memory: 4g
        executor_cores: 2
        num_executors: 10
      
    - name: risk_scoring_batch
      type: spark_submit
      script: RiskScoringBatchJob.py
      depends_on: [transfer_correction]
      
    - name: graph_analysis_batch
      type: http_trigger
      url: http://graph-engine:8084/admin/clustering/run
      depends_on: [transfer_correction]
```

#### 特点
- ✅ **准确性高**：完整解析逻辑
- ✅ **数据完整**：从全节点重新扫描
- ✅ **处理复杂场景**：重组、新合约、复杂 ML 模型
- ⚠️ **延迟高**：T+1 天

---

### 3️⃣ Serving Layer（服务层）

#### 职责
合并批视图和实时视图，提供统一查询接口

#### 技术栈
- **Query Service** (Go) - 查询 PostgreSQL
- **Risk Service** (Python) - 风险评分
- **Alert Service** (Go) - 告警服务
- **Graph Engine** (Java) - 图分析

#### 查询策略

```go services/query-service/internal/service/transfer_service.go
func (s *TransferService) GetAddressTransfers(address string) ([]Transfer, error) {
    // 查询策略：优先使用 batch 数据，其次 stream 数据
    transfers, err := s.repo.FindByAddress(address, TransferQuery{
        OrderBy: "CASE WHEN source = 'batch' THEN 0 ELSE 1 END, timestamp DESC",
        Limit:   100,
    })
    
    // 标记数据来源
    for i := range transfers {
        if transfers[i].Source == "stream" && transfers[i].CorrectedAt == nil {
            transfers[i].DataQuality = "realtime"  // 实时数据，可能有误
        } else {
            transfers[i].DataQuality = "verified"  // 批处理验证过的数据
        }
    }
    
    return transfers, err
}
```

#### Graph Engine 增量 + 批量分析

```java processing/graph-engine/src/main/java/com/chainrisk/graph/service/impl/GraphSyncServiceImpl.java
@Service
@RequiredArgsConstructor
public class GraphSyncServiceImpl implements GraphSyncService {
    
    // ✅ 增量分析（Kafka 触发）
    @KafkaListener(topics = "transfers", groupId = "graph-engine")
    public void onNewTransfer(Transfer transfer) {
        log.debug("Received new transfer: {}", transfer.getTxHash());
        
        // 1. 增量聚类
        if (shouldTriggerClustering(transfer)) {
            clusteringService.runIncrementalClustering(
                transfer.getFromAddr(), 
                transfer.getToAddr()
            );
        }
        
        // 2. 增量标签传播
        if (isHighRiskAddress(transfer.getFromAddr())) {
            tagPropagationService.propagateFromAddress(transfer.getFromAddr());
        }
    }
    
    // ✅ 批量分析（定时任务）
    @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨 3 点
    public void runBatchAnalysis() {
        log.info("Starting daily batch graph analysis");
        
        // 1. 全图聚类
        clusteringService.runFullClustering();
        
        // 2. 全图标签传播
        tagPropagationService.propagateAllTags();
        
        // 3. PageRank
        graphAnalysisService.runPageRank();
        
        // 4. 社区发现
        graphAnalysisService.runCommunityDetection();
    }
}
```

---

## 📊 数据表设计

### PostgreSQL 表结构

```sql
-- transfers 表（支持流批覆盖）
CREATE TABLE transfers (
    tx_hash VARCHAR(66) PRIMARY KEY,
    block_number BIGINT NOT NULL,
    from_addr VARCHAR(42) NOT NULL,
    to_addr VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    token_address VARCHAR(42),
    timestamp BIGINT NOT NULL,
    network VARCHAR(20) NOT NULL DEFAULT 'ethereum',
    
    -- 元数据
    source VARCHAR(10) NOT NULL,  -- 'stream' 或 'batch'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    corrected_at TIMESTAMP,  -- 批处理覆盖时间
    
    INDEX idx_from_addr (from_addr),
    INDEX idx_to_addr (to_addr),
    INDEX idx_block_number (block_number),
    INDEX idx_source (source)
);

-- 查询示例：优先使用 batch 数据
SELECT * FROM transfers 
WHERE from_addr = '0x123...'
ORDER BY 
    CASE WHEN source = 'batch' THEN 0 ELSE 1 END,
    timestamp DESC
LIMIT 100;
```

### Neo4j 图结构

```cypher
// Address 节点
CREATE (a:Address {
    address: '0x123...',
    network: 'ethereum',
    risk_score: 0.5,
    tags: ['high_frequency', 'mixer_interaction'],
    source: 'stream',  // 'stream' 或 'batch'
    first_seen: timestamp(),
    corrected_at: timestamp()  // 批处理覆盖时间
})

// TRANSFER 关系
CREATE (from)-[r:TRANSFER {
    tx_hash: '0xabc...',
    amount: '1000000000000000000',
    timestamp: 1704240000,
    block_number: 18000000,
    source: 'stream',  // 'stream' 或 'batch'
    corrected_at: timestamp()  // 批处理覆盖时间
}]->(to)

// 查询示例：优先使用 batch 数据
MATCH (from:Address {address: $addr})-[r:TRANSFER]->(to)
RETURN from, r, to
ORDER BY 
    CASE WHEN r.source = 'batch' THEN 0 ELSE 1 END,
    r.timestamp DESC
LIMIT 100
```

---

## 🎯 应用场景对比

### 场景 1: Transfer 数据提取

| 维度 | Flink 流处理 | Spark 批处理 |
|-----|-------------|-------------|
| **数据源** | Kafka 实时消息 | 全节点 RPC 重新扫描 |
| **解析逻辑** | 简化版（快速） | 完整版（处理复杂合约） |
| **数据完整性** | 可能丢失 | 保证完整 |
| **区块重组** | 无法处理 | 等待确认后处理 |
| **新合约支持** | 需要重启更新 | 可以回填历史数据 |
| **延迟** | 秒级 | T+1 天 |

**覆盖原因**: 流处理可能丢失数据、解析错误、区块重组

---

### 场景 2: 地址风险评分

| 维度 | Flink 流处理 | Spark 批处理 |
|-----|-------------|-------------|
| **特征工程** | 窗口内简单特征 | 全局历史特征 |
| **模型复杂度** | 轻量规则引擎 | 复杂 ML 模型（XGBoost、GNN） |
| **计算资源** | 受限（延迟要求） | 充足（可用大量 CPU/GPU） |
| **数据完整性** | 可能缺少关联数据 | 可以 JOIN 所有历史表 |
| **延迟** | 秒级 | T+1 天 |

**覆盖原因**: 批处理可以计算全局特征、使用复杂模型

---

### 场景 3: 地址聚类与标签传播

| 维度 | Graph Engine 增量 | Graph Engine 批量 |
|-----|------------------|------------------|
| **触发方式** | Kafka 消息触发 | 定时任务（每日凌晨） |
| **分析范围** | 局部子图 | 全图 |
| **算法复杂度** | 简单聚类（Union-Find） | PageRank、Louvain、社区发现 |
| **迭代计算** | 不支持 | 支持（Spark GraphX） |
| **延迟** | 秒级 | 每日 |

**覆盖原因**: 批量分析可以运行复杂图算法、获得全局视图

---

## 📈 监控与数据质量

### 数据差异报告

```sql
-- 每日流批数据差异统计
SELECT 
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE source = 'stream') as stream_count,
    COUNT(*) FILTER (WHERE source = 'batch') as batch_count,
    COUNT(*) FILTER (WHERE corrected_at IS NOT NULL) as corrected_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE corrected_at IS NOT NULL) / 
          NULLIF(COUNT(*) FILTER (WHERE source = 'stream'), 0), 2) as correction_rate_pct
FROM transfers
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 监控指标

```yaml
metrics:
  # 流处理指标
  flink_stream:
    - kafka_lag: 消息积压量
    - processing_rate: 处理速率（条/秒）
    - error_rate: 解析错误率
    - neo4j_write_latency: Neo4j 写入延迟
    
  # 批处理指标
  spark_batch:
    - job_duration: 任务执行时长
    - records_processed: 处理记录数
    - correction_count: 修正记录数
    - correction_rate: 修正率
    
  # 图分析指标
  graph_engine:
    - incremental_analysis_latency: 增量分析延迟
    - batch_analysis_duration: 批量分析时长
    - clusters_created: 创建的聚类数
    - tags_propagated: 传播的标签数
```

---

## 🚀 优势总结

| 维度 | Lambda 架构优势 |
|-----|----------------|
| **实时性** | Flink 直接写入 Neo4j，Graph Engine 秒级响应 |
| **准确性** | Spark 批处理覆盖修正错误数据 |
| **数据完整性** | 批处理保证最终一致性 |
| **系统解耦** | 流批分离，Graph Engine 无需同步数据 |
| **资源优化** | 减少 PostgreSQL 查询压力，无重复计算 |
| **可扩展性** | 流批独立扩展，互不影响 |

---

## 📚 相关文档

- [项目总览](./PROJECT_OVERVIEW.md)
- [技术决策记录](./TECH_DECISIONS.md)
- [开发计划](../development/DEVELOPMENT_PLAN.md)

---

**最后更新**: 2026-01-03
