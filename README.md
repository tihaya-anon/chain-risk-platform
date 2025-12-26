# Chain Risk Platform

> 多语言微服务架构的链上风险分析系统

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![Java](https://img.shields.io/badge/Java-17+-ED8B00?style=flat&logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://typescriptlang.org/)

## 🎯 项目简介

一个用于链上交易数据分析和地址风险评估的微服务平台，支持：

- **实时数据流处理**: 链上交易 → Transfer 解析
- **风险评分**: 基于规则引擎 + ML 模型
- **地址聚类**: 实体识别和 Tag Propagation
- **告警系统**: 异常交易实时告警

## 🏗️ 技术架构

```
Frontend (React) → BFF (Nest.js) → Microservices (Go/Python/Java)
                                          ↓
                              Flink Stream Processing
                                          ↓
                              Kafka → PostgreSQL/Neo4j
```

详细架构请参考 [PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md)

## 🛠️ 技术栈

| 层级           | 技术                                            |
| -------------- | ----------------------------------------------- |
| **Frontend**   | React, TypeScript, Vite                         |
| **BFF**        | Nest.js, TypeScript                             |
| **Services**   | Go (Gin), Python (FastAPI), Java (Spring Cloud) |
| **Processing** | Apache Flink, Kafka                             |
| **Storage**    | PostgreSQL, Neo4j, Redis                        |
| **Infra**      | Docker, Kubernetes                              |

## 📁 项目结构

```
chain-risk-platform/
├── services/           # 微服务
│   ├── bff-gateway/    # TypeScript/Nest.js
│   ├── query-service/  # Go/Gin
│   ├── alert-service/  # Go/Gin
│   ├── risk-ml-service/# Python/FastAPI
│   └── orchestrator/   # Java/Spring Cloud
├── processing/         # 数据处理
│   ├── stream-processor/   # Java/Flink
│   ├── batch-processor/    # Java/Flink SQL
│   └── graph-engine/       # Java
├── data-ingestion/     # Go - 数据采集
├── frontend/           # React
├── infra/              # 基础设施配置
└── docs/               # 文档
```

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose
- Go 1.21+
- Java 17+
- Python 3.11+
- Node.js 18+

### 启动开发环境

```bash
# 1. 克隆项目
git clone https://github.com/0ksks/chain-risk-platform.git
cd chain-risk-platform

# 2. 启动基础设施
docker-compose up -d

# 3. 启动各服务 (参考各服务目录的 README)
```

### 服务端口

| 服务            | 端口 |
| --------------- | ---- |
| BFF Gateway     | 3000 |
| Query Service   | 8081 |
| Risk ML Service | 8082 |
| Alert Service   | 8083 |
| Frontend        | 5173 |
| PostgreSQL      | 5432 |
| Redis           | 6379 |
| Kafka           | 9092 |

## 📚 文档

- [项目总览](./docs/PROJECT_OVERVIEW.md)
- [开发计划](./docs/DEVELOPMENT_PLAN.md)
- [技术决策](./docs/TECH_DECISIONS.md)

## 🗺️ Roadmap

- [x] 项目规划和文档
- [ ] Phase 1: 核心数据流
- [ ] Phase 2: 查询与风险服务
- [ ] Phase 3: BFF 与前端
- [ ] Phase 4: 高级功能

## 📄 License

MIT License
