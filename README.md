# Chain Risk Platform

> 多语言微服务架构的链上风险分析系统（Lambda 架构）

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![Java](https://img.shields.io/badge/Java-17+-ED8B00?style=flat&logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://typescriptlang.org/)
[![Scala](https://img.shields.io/badge/Scala-2.12+-DC322F?style=flat&logo=scala)](https://scala-lang.org/)

## 🎯 项目简介

一个基于 **Lambda 架构**的链上交易数据分析和地址风险评估微服务平台，支持：

- **实时流处理**: Flink 秒级解析链上交易，双写 PostgreSQL + Neo4j
- **批处理覆盖**: Spark 每日修正数据，保证最终一致性
- **风险评分**: 规则引擎 + ML 模型（实时 + 批量）
- **地址聚类**: 图算法识别实体（Common Input Heuristic）
- **标签传播**: BFS 多跳风险传播（增量 + 批量）
- **告警系统**: 异常交易实时告警

## 🏗️ Lambda 架构

### 核心思想
- **Speed Layer（Flink）**: 实时流处理，秒级响应，可能有错
- **Batch Layer（Spark）**: 批处理覆盖，准确修正，T+1 天
- **Serving Layer（微服务）**: 合并视图，统一查询

### 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React/TypeScript)                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                 Orchestrator (Java/Spring Cloud Gateway)            │
│          JWT认证 / 路由 / 限流 / 熔断 / API编排                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ X-User-Id/Username/Role
┌─────────────────────────────────▼───────────────────────────────────┐
│                      BFF Layer (TypeScript/Nest.js)                 │
│                    业务聚合 / 数据转换 / 信任Gateway                │
└───────────┬─────────────────────┬─────────────────────┬─────────────┘
            │                     │                     │
┌───────────▼───────────┐ ┌───────▼───────┐ ┌─────────────▼───────────┐
│    Query Service      │ │ Risk Service  │ │      Alert Service      │
│        (Go)           │ │   (Python)    │ │          (Go)           │
│      Gin + GORM       │ │   FastAPI     │ │          Gin            │
└───────────┬───────────┘ └───────┬───────┘ └───────────┬───────────┘
            │                     │                     │
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
┌──────────────────────▼─────────────────────▼────────────────────────┐
│                  Data & Processing Layer (Lambda)                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │         Data Ingestion (Go) → Kafka Topics             │         │
│  └─────────────────────────┬──────────────────────────────┘         │
│                            │                                        │
│       ┌────────────────────┴────────────────┐                       │
│       │                                     │                       │
│       ▼                                     ▼                       │
│  ┌──────────────┐                     ┌──────────────┐             │
│  │ Speed Layer  │                     │ Batch Layer  │             │
│  │              │                     │              │             │
│  │ Flink Stream │                     │ Spark Batch  │             │
│  │ (实时流处理) │                     │ (每日批处理) │             │
│  │              │                     │              │             │
│  │ - 快速解析   │                     │ - 完整解析   │             │
│  │ - 双写数据库 │                     │ - 覆盖修正   │             │
│  │ - 简单规则   │                     │ - 复杂模型   │             │
│  └────┬─────┬───┘                     └────┬─────┬───┘             │
│       │     │                              │     │                 │
│       │     └──────────────┐   ┌───────────┘     │                 │
│       │                    │   │                 │                 │
│       ▼                    ▼   ▼                 ▼                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │ PostgreSQL   │     │    Neo4j     │     │ Graph Engine │       │
│  │              │     │              │     │              │       │
│  │ source:      │     │ source:      │     │ - 增量聚类   │       │
│  │ stream/batch │     │ stream/batch │     │ - 批量分析   │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

详细架构请参考：
- [项目总览](./docs/architecture/PROJECT_OVERVIEW.md)
- [Lambda 架构详解](./docs/architecture/LAMBDA_ARCHITECTURE.md)

## 🛠️ 技术栈

| 层级             | 技术                                     | 说明                     |
| ---------------- | ---------------------------------------- | ------------------------ |
| **Frontend**     | React, TypeScript, Vite                  | 风险仪表盘               |
| **Orchestrator** | Java, Spring Cloud Gateway, Resilience4j | API 网关 + 编排          |
| **BFF**          | Nest.js, TypeScript                      | 业务聚合层               |
| **Services**     | Go (Gin), Python (FastAPI)               | 微服务（查询、风险、告警）|
| **Speed Layer**  | Apache Flink, Kafka                      | 实时流处理               |
| **Batch Layer**  | Apache Spark, Scala                      | 批处理覆盖               |
| **Graph**        | Java, Spring Boot, Neo4j                 | 图分析服务               |
| **Storage**      | PostgreSQL, Neo4j, Redis                 | 数据存储                 |
| **Infra**        | Docker, Kubernetes                       | 基础设施                 |

## 📁 项目结构

```
chain-risk-platform/
├── services/           # 微服务层（Serving Layer）
│   ├── orchestrator/   # Java/Spring Cloud Gateway - API网关+编排
│   ├── bff/            # TypeScript/Nest.js - 业务聚合层
│   ├── query-service/  # Go/Gin - 查询服务
│   ├── alert-service/  # Go/Gin - 告警服务
│   └── risk-ml-service/# Python/FastAPI - 风险评分服务
│
├── processing/         # 数据处理层（Speed + Batch Layer）
│   ├── stream-processor/   # Java/Flink - 实时流处理
│   │   ├── Transfer 解析
│   │   └── 双写 PostgreSQL + Neo4j
│   │
│   ├── batch-processor/    # Scala/Spark - 批处理覆盖
│   │   ├── 完整解析逻辑
│   │   └── 覆盖写入 PostgreSQL + Neo4j
│   │
│   └── graph-engine/       # Java/Spring Boot + Neo4j
│       ├── 地址聚类（Common Input Heuristic）
│       ├── Tag Propagation（BFS）
│       └── 增量 + 批量图分析
│
├── data-ingestion/     # Go - 链上数据采集
├── frontend/           # React - 风险仪表盘
├── infra/              # 基础设施配置
│   ├── docker-compose.yml
│   ├── k8s/
│   └── terraform/
│
└── docs/               # 文档
    ├── architecture/   # 架构设计
    ├── development/    # 开发计划
    ├── operations/     # 操作手册
    └── api-specs/      # API 规范
```

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose
- Go 1.21+
- Java 17+
- Scala 2.12+
- Python 3.11+
- Node.js 18+

### 启动开发环境

```bash
# 1. 克隆项目
git clone https://github.com/0ksks/chain-risk-platform.git
cd chain-risk-platform

# 2. 启动基础设施（PostgreSQL, Neo4j, Kafka, Redis）
docker-compose up -d

# 3. 启动各服务
make run-svc

# 4. 查看服务状态
make infra-check
```

### 服务端口

| 服务              | 端口 | 说明                     |
| ----------------- | ---- | ------------------------ |
| Orchestrator      | 8080 | API 网关                 |
| BFF               | 3001 | 业务聚合层               |
| Query Service     | 8081 | 查询服务                 |
| Risk ML Service   | 8082 | 风险评分服务             |
| Alert Service     | 8083 | 告警服务                 |
| Graph Engine      | 8084 | 图分析服务               |
| Frontend          | 5173 | 前端仪表盘               |
| PostgreSQL        | 5432 | 关系型数据库             |
| Neo4j             | 7474 | 图数据库（HTTP）         |
| Neo4j Bolt        | 7687 | 图数据库（Bolt）         |
| Redis             | 6379 | 缓存                     |
| Kafka             | 9092 | 消息队列                 |

## 📚 文档

### 架构文档
- [📖 项目总览](./docs/architecture/PROJECT_OVERVIEW.md) - 系统架构、技术栈、数据流
- [🏗️ Lambda 架构详解](./docs/architecture/LAMBDA_ARCHITECTURE.md) - 流批一体处理设计
- [🔧 技术决策记录](./docs/architecture/TECH_DECISIONS.md) - TDR 文档
- [🌐 Gateway+BFF 架构](./docs/architecture/GATEWAY_BFF_ARCHITECTURE.md) - 网关与 BFF 设计

### 开发文档
- [📅 开发计划](./docs/development/DEVELOPMENT_PLAN.md) - MVP 分阶段计划
- [📊 开发进度](./docs/development/PROGRESS.md) - 实时进度追踪
- [🧪 测试计划](./docs/development/PHASE1_TEST_PLAN.md) - Phase 1 测试

### 操作手册
- [🚀 Scripts 快速参考](./docs/operations/SCRIPTS_QUICK_REFERENCE.md) - 常用命令速查
- [📝 Scripts 使用指南](./scripts/README.md) - 完整脚本文档
- [🔄 Git 工作流](./docs/operations/GIT_WORKFLOW.md) - 分支策略、提交规范

### API 文档
- [📡 API 规范管理](./docs/api-specs/API_SPECS_GUIDE.md) - OpenAPI 生成与更新
- [🔗 API 快速参考](./docs/api-specs/API_SPECS_QUICK_REF.md) - 各服务 API 地址

### 完整导航
- [📖 文档中心](./docs/README.md) - 所有文档索引

## 🎯 核心特性

### 1. Lambda 架构 - 流批一体

| 特性 | Speed Layer (Flink) | Batch Layer (Spark) |
|-----|---------------------|---------------------|
| **延迟** | 秒级 | T+1 天 |
| **准确性** | 中等（可能有错） | 高（完整解析） |
| **数据源** | Kafka 实时消息 | 全节点 RPC 重新扫描 |
| **写入策略** | 双写 PostgreSQL + Neo4j | 覆盖修正 stream 数据 |
| **应用场景** | 实时查询、快速告警 | 数据修正、复杂分析 |

### 2. 图分析 - 增量 + 批量

| 分析类型 | 触发方式 | 分析范围 | 算法 |
|---------|---------|---------|------|
| **增量分析** | Kafka 消息触发 | 局部子图 | 增量聚类、增量标签传播 |
| **批量分析** | 定时任务（每日） | 全图 | PageRank、Louvain、社区发现 |

### 3. 数据质量保证

```sql
-- 数据来源标记
source: 'stream' | 'batch'

-- 查询策略：优先使用 batch 数据
SELECT * FROM transfers 
WHERE from_addr = '0x123...'
ORDER BY 
    CASE WHEN source = 'batch' THEN 0 ELSE 1 END,
    timestamp DESC
```

## 🔧 Makefile 命令

查看所有可用命令：
```bash
make help
```

### 常用命令

```bash
# 基础设施管理
make infra-up          # 启动基础设施（PostgreSQL, Neo4j, Kafka, Redis）
make infra-down        # 停止基础设施
make infra-check       # 检查基础设施状态
make infra-clean       # 清理基础设施数据

# 服务管理
make run-svc           # 启动所有服务（后台）
make stop-svc          # 停止所有服务
make logs-all          # 查看所有日志
make logs-flink        # 查看 Flink 日志
make logs-graph        # 查看 Graph Engine 日志

# 构建和测试
make init-all          # 初始化所有服务
make build-all         # 构建所有服务
make test-all          # 运行所有测试

# 数据处理
make flink-submit      # 提交 Flink 作业
make spark-submit      # 提交 Spark 作业
make graph-sync        # 触发 Graph Engine 同步
make graph-cluster     # 触发地址聚类
```

详细说明请参考 [Scripts 快速参考](./docs/operations/SCRIPTS_QUICK_REFERENCE.md)

## 📊 监控与数据质量

### 数据差异监控

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

### 关键指标

- **Flink 流处理**: Kafka Lag, 处理速率, 错误率
- **Spark 批处理**: 任务时长, 修正记录数, 修正率
- **Graph Engine**: 增量分析延迟, 聚类数, 标签传播数

## 🗺️ Roadmap

- [x] 项目规划和文档
- [x] Phase 1: 核心数据流（Flink Stream）
- [x] Phase 2: 查询与风险服务（基础功能）
- [x] Phase 3: BFF 与前端（基础功能）
- [x] Lambda 架构设计（流批分离）
- [ ] Phase 4: Spark 批处理实现
- [ ] Phase 5: Graph Engine 优化（增量 + 批量）
- [ ] Phase 6: 高级功能（ML 模型、复杂图算法）

## 🤝 贡献指南

请参考 [Git 工作流指南](./docs/operations/GIT_WORKFLOW.md)

## 📄 License

MIT License

---

**最后更新**: 2026-01-03
