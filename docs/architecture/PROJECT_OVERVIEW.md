# Chain Risk Platform - 项目总览

> 多语言微服务架构的链上风险分析系统

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

## 🏗️ 系统架构

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
│    Query Service      │ │ Risk Service  │ │ Alert Service (规划中)│
│        (Go)           │ │   (Python)    │ │        (Go)           │
│      Gin + GORM       │ │   FastAPI     │ │        Gin            │
└───────────┬───────────┘ └───────┬───────┘ └───────────┬───────────┘
            │                     │                     │
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
┌──────────────────────▼─────────────────────▼────────────────────────┐
│                     Data & Processing Layer                         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
           ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
           │ Flink   │      │ Transfer  │     │   Graph   │
           │ Stream  │      │  Parser   │     │  Engine   │
           │ (Java)  │      │  (Java)   │     │  (Java)   │
           └────┬────┘      └─────┬─────┘     └─────┬─────┘
                │                 │                 │
                └──────────┬────────┴──────────┬────────┘
                         │                 │
                   ┌─────▼─────┐     ┌─────▼─────┐
                   │   Kafka   │     │PostgreSQL │
                   │           │     │ + Neo4j   │
                   └───────────┘     └───────────┘
```

**注**: Alert Service 和 Batch Processor 目前仅有项目骨架，功能规划中。

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
│   ├── alert-service/         # Go (Gin) - 规划中
│   │   └── 告警规则引擎、通知推送
│   │
│   └── risk-ml-service/       # Python (FastAPI)
│       └── 风险评分模型、特征工程
│
├── processing/
│   ├── stream-processor/      # Java (Flink)
│   │   └── 实时交易流处理
│   │
│   ├── batch-processor/       # Java (Flink SQL / Spark) - 规划中
│   │   └── 每日批处理覆盖
│   │
│   └── graph-engine/          # Java
│       └── 地址聚类、Tag Propagation
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
| **Stream**       | Java/Flink         | 实时计算                        | 数据处理类项目         |
| **Ingestion**    | Go                 | 高并发采集                      | 爬虫、数据同步         |

---

## 📚 相关文档

- [开发计划](./DEVELOPMENT_PLAN.md)
- [技术决策记录](./TECH_DECISIONS.md)
- [API 规范](./api-specs/)
