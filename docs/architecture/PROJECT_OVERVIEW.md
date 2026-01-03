# Chain Risk Platform - 项目总览

> 多语言微服务架构的链上风险分析系统（Lambda 架构）

## 🎯 项目目标

### 双重目标
1. **新加坡 Crypto 合规岗位**: 展示区块链数据处理 + 合规分析能力
2. **线上后端接单**: 展示多语言技术栈，方便复用

---

## 📊 个人技术栈

| 领域           | 技术栈                            | 熟练度 |
| -------------- | --------------------------------- | ------ |
| **核心竞争力** | Java/Flink/Kafka + 区块链数据处理 | ⭐⭐⭐⭐⭐  |
| **后端开发**   | SpringBoot, Go Gin/GORM           | ⭐⭐⭐⭐   |
| **AI/ML**      | PyTorch, Pandas, ML/RL, Agent     | ⭐⭐⭐⭐   |
| **前端**       | Vue, React (Hook 不熟)            | ⭐⭐⭐    |
| **DevOps**     | Docker, K8s                       | ⭐⭐⭐    |

---

## 🏗️ 系统架构（Lambda 架构）

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│              Orchestrator (Java/Spring Cloud Gateway)               │
│        JWT认证 / 路由 / 限流 / 熔断 / Fallback / API编排            │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ X-User-Id
                                  │ X-User-Username
                                  │ X-User-Role
┌─────────────────────────────────▼───────────────────────────────────┐
│                      BFF Layer (TypeScript/Nest.js)                 │
│                业务聚合 / 数据转换 / 信任Gateway用户上下文          │
└───────────┬─────────────────────┬─────────────────────┬─────────────┘
            │                     │                     │
┌───────────▼───────────┐ ┌───────▼───────┐ ┌───────────▼───────────┐
│    Query Service      │ │ Risk Service  │ │    Alert Service      │
│        (Go)           │ │   (Python)    │ │        (Go)           │
│      Gin + GORM       │ │   FastAPI     │ │        Gin            │
└───────────┬───────────┘ └───────┬───────┘ └───────────┬───────────┘
            │                     │                     │
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
┌──────────────────────▼─────────────────────▼────────────────────────┐
│                     Data & Processing Layer                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │              Data Ingestion (Go)                       │         │
│  │          链上数据采集 → Kafka Producer                 │         │
│  └─────────────────────────┬──────────────────────────────┘         │
│                            │                                        │
│                            ▼                                        │
│                   ┌────────────────┐                                │
│                   │  Kafka Topics  │                                │
│                   │  - raw-blocks  │                                │
│                   │  - transfers   │                                │
│                   └────┬───────┬───┘                                │
│                        │       │                                    │
│       ┌────────────────┘       └────────────────┐                   │
│       │                                         │                   │
│       ▼                                         ▼                   │
│  ┌──────────────┐                         ┌──────────────┐         │
│  │ Flink Stream │                         │ Spark Batch  │         │
│  │ (实时流处理) │                         │ (每日批处理) │         │
│  │              │                         │              │         │
│  │ - 解析Transfer                         │ - 重新扫描区块│         │
│  │ - 双写数据库 │                         │ - 完整解析   │         │
│  │ - 实时风险   │                         │ - 覆盖修正   │         │
│  └────┬─────┬───┘                         └────┬─────┬───┘         │
│       │     │                                  │     │             │
│       │     └──────────────┐   ┌──────────────┘     │             │
│       │                    │   │                    │             │
│       ▼                    ▼   ▼                    ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      │
│  │ PostgreSQL   │     │    Neo4j     │     │ Graph Engine │      │
│  │              │     │              │     │              │      │
│  │ - transfers  │     │ - Address    │     │ - 地址聚类   │      │
│  │ - addresses  │     │ - TRANSFER   │     │ - Tag传播    │      │
│  │ - risk_scores│     │ - Cluster    │     │ - 图查询API  │      │
│  │              │     │              │     │              │      │
│  │ source:      │     │ source:      │     │ 触发方式:    │      │
│  │ stream/batch │     │ stream/batch │     │ Kafka + 定时 │      │
│  └──────────────┘     └──────────────┘     └──────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 数据流详解

### 1️⃣ 实时流处理（Flink Stream）

**目标**: 秒级数据处理，快速响应

```
链上数据 → Kafka (raw-blocks)
              ↓
        Flink Stream Processor
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
PostgreSQL          Neo4j
(source='stream')   (source='stream')
    ↓                   ↓
Query Service      Graph Engine
                   (增量图分析)
```

**处理逻辑**:
- 消费 Kafka `raw-blocks` Topic
- 解析 Transfer（Native + ERC20）
- **双写策略**:
  - PostgreSQL: 用于 OLTP 查询（Query Service）
  - Neo4j: 用于实时图分析（Graph Engine）
- 发送到 Kafka `transfers` Topic 触发下游服务
- 简单实时风险规则（黑名单检查）

**特点**:
- ✅ 实时性好（秒级延迟）
- ⚠️ 可能有数据丢失或解析错误
- ⚠️ 无法处理复杂合约或区块重组

---

### 2️⃣ 批处理覆盖（Spark Batch）

**目标**: 数据准确性，最终一致性

```
全节点 RPC (重新扫描昨天区块)
              ↓
        Spark Batch Processor
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
PostgreSQL          Neo4j
(source='batch')    (source='batch')
覆盖 stream 数据    覆盖 stream 数据
    ↓                   ↓
Query Service      Graph Engine
                   (全量图分析)
```

**处理逻辑**:
- 每日凌晨从全节点 RPC 重新扫描昨天的所有区块
- 使用完整的解析逻辑（处理复杂合约、重组、新合约类型）
- **覆盖策略**:
  - PostgreSQL: `ON CONFLICT DO UPDATE SET source='batch'`
  - Neo4j: `ON MATCH SET source='batch', corrected_at=timestamp()`
- 计算全局特征（如地址的历史交易模式）
- 触发 Graph Engine 全量图分析

**特点**:
- ✅ 准确性高（完整解析逻辑）
- ✅ 处理复杂场景（重组、新合约）
- ⚠️ 延迟较高（T+1 天）

---

### 3️⃣ 图分析服务（Graph Engine）

**目标**: 地址关系分析，风险传播

```
Neo4j 图数据
    ↓
┌───┴────────────────┐
│                    │
↓                    ↓
实时增量分析         每日批量分析
(Kafka 触发)         (定时任务)
│                    │
├─ 增量聚类          ├─ 全图聚类
│  (Common Input)    │  (Common Input)
│                    │
├─ 增量标签传播      ├─ 全图标签传播
│  (BFS)             │  (BFS)
│                    │
└─ 实时图查询        └─ PageRank
                        Community Detection
```

**处理逻辑**:
- **实时增量分析**:
  - 监听 Kafka `transfers` Topic
  - 检测新交易是否触发聚类条件
  - 从高风险地址传播标签
- **批量分析**（每日凌晨 3 点）:
  - 全图聚类（Union-Find 算法）
  - 全图标签传播（BFS 多跳传播）
  - PageRank 识别重要节点
  - Community Detection 社区发现

**特点**:
- ✅ 实时性好（秒级增量分析）
- ✅ 准确性高（批量全图分析）
- ✅ 无需从 PostgreSQL 同步数据（Flink/Spark 直接写入 Neo4j）

---

## 📦 项目结构

```
chain-risk-platform/
│
├── services/
│   ├── orchestrator/          # Java (Spring Cloud Gateway)
│   │   └── API网关、JWT认证、路由、限流、熔断、API编排
│   │
│   ├── bff/                   # TypeScript (Nest.js)
│   │   └── 业务聚合、数据转换、信任Gateway用户上下文
│   │
│   ├── query-service/         # Go (Gin + GORM)
│   │   └── 地址/交易查询、分页、缓存
│   │
│   ├── alert-service/         # Go (Gin)
│   │   └── 告警规则引擎、通知推送
│   │
│   └── risk-ml-service/       # Python (FastAPI)
│       └── 风险评分模型、特征工程
│
├── processing/
│   ├── stream-processor/      # Java (Flink)
│   │   ├── 实时交易流处理
│   │   ├── Transfer 解析
│   │   └── 双写 PostgreSQL + Neo4j
│   │
│   ├── batch-processor/       # Scala (Spark)
│   │   ├── 每日批处理覆盖
│   │   ├── 完整解析逻辑
│   │   └── 覆盖写入 PostgreSQL + Neo4j
│   │
│   └── graph-engine/          # Java (Spring Boot + Neo4j)
│       ├── 地址聚类（Common Input Heuristic）
│       ├── Tag Propagation（BFS）
│       ├── 图查询 REST API
│       └── 增量 + 批量图分析
│
├── data-ingestion/            # Go
│   └── 链上数据采集、Kafka Producer
│
├── frontend/                  # React + TypeScript
│   └── 风险仪表盘
│
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/
│   └── terraform/
│
└── docs/
    ├── PROJECT_OVERVIEW.md    # 本文件
    ├── DEVELOPMENT_PLAN.md    # 开发计划
    ├── TECH_DECISIONS.md      # 技术决策
    ├── LAMBDA_ARCHITECTURE.md # Lambda 架构详解
    ├── GATEWAY_BFF_ARCHITECTURE.md  # Gateway+BFF架构
    ├── ORCHESTRATOR_ARCHITECTURE.md # Orchestrator架构
    └── api-specs/
```

---

## 🔧 语言职责与接单映射

| 模块             | 语言               | 职责                            | 接单可复用场景         |
| ---------------- | ------------------ | ------------------------------- | ---------------------- |
| **Orchestrator** | Java/Spring Cloud  | API网关、认证、限流、熔断、编排 | 企业级网关、微服务架构 |
| **BFF**          | TypeScript/Nest.js | 业务聚合、数据转换              | 任何需要BFF的项目      |
| **Query/Alert**  | Go/Gin             | 高性能微服务                    | CRUD类后端、工具类服务 |
| **Risk ML**      | Python/FastAPI     | ML推理服务                      | AI相关项目、数据分析   |
| **Flink Stream** | Java/Flink         | 实时流处理、双写数据库          | 实时数据处理项目       |
| **Spark Batch**  | Scala/Spark        | 批处理、数据修正                | 大数据批处理项目       |
| **Graph Engine** | Java/Spring+Neo4j  | 图分析、聚类、标签传播          | 图数据库应用、关系分析 |
| **Ingestion**    | Go                 | 高并发采集                      | 爬虫、数据同步         |

---

## 🎯 Lambda 架构优势

| 维度 | 传统架构 | Lambda 架构（本项目） |
|-----|---------|---------------------|
| **实时性** | 中等（需定时同步） | 优秀（Flink 直接写入 Neo4j，秒级） |
| **准确性** | 中等（流处理可能有错） | 优秀（Spark 批处理覆盖修正） |
| **数据完整性** | 弱（同步可能失败） | 强（批处理保证最终一致性） |
| **系统复杂度** | 低 | 中等（流批分离） |
| **资源利用率** | 低（重复计算） | 高（各司其职，无重复） |
| **可扩展性** | 中等 | 优秀（流批独立扩展） |

---

## 📊 应用场景示例

### 场景 1: Transfer 数据提取与修正

| 阶段 | 处理方式 | 数据源 | 准确性 | 实时性 |
|-----|---------|-------|-------|-------|
| **实时** | Flink 流处理 | Kafka | 中等（可能有错） | 秒级 |
| **修正** | Spark 批处理 | 全节点 RPC | 高（完整解析） | T+1 天 |

**覆盖原因**: 流处理可能丢失数据、解析错误、区块重组

---

### 场景 2: 地址风险评分

| 阶段 | 处理方式 | 特征工程 | 模型复杂度 | 实时性 |
|-----|---------|---------|-----------|-------|
| **实时** | Flink 流处理 | 简单窗口特征 | 轻量规则引擎 | 秒级 |
| **修正** | Spark 批处理 | 全局历史特征 | 复杂 ML 模型 | T+1 天 |

**覆盖原因**: 批处理可以计算全局特征、使用复杂模型

---

### 场景 3: 地址聚类与标签传播

| 阶段 | 处理方式 | 分析范围 | 算法复杂度 | 实时性 |
|-----|---------|---------|-----------|-------|
| **实时** | Graph Engine 增量 | 局部子图 | 简单聚类 | 秒级 |
| **修正** | Graph Engine 批量 | 全图 | PageRank、社区发现 | 每日 |

**覆盖原因**: 批量分析可以运行复杂图算法、获得全局视图

---

## 📚 相关文档

- [开发计划](./DEVELOPMENT_PLAN.md)
- [技术决策记录](./TECH_DECISIONS.md)
- [Lambda 架构详解](./LAMBDA_ARCHITECTURE.md)
- [API 规范](./api-specs/)

---

**最后更新**: 2026-01-03
