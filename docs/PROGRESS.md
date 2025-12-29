# 开发进度追踪

> 最后更新: 2025-12-29

## 📊 总体进度

| Phase                   | 状态     | 进度 | 说明                             |
| ----------------------- | -------- | ---- | -------------------------------- |
| Phase 1: 核心数据流     | ✅ 已完成 | 100% | 端到端数据流验证通过，监控已配置 |
| Phase 2: 查询与风险服务 | 🔲 未开始 | 0%   | -                                |
| Phase 3: BFF与前端      | 🔲 未开始 | 0%   | -                                |
| Phase 4: 高级功能       | 🔲 未开始 | 0%   | -                                |

状态图例: 🔲 未开始 | 🔶 进行中 | ✅ 已完成 | ⏸️ 暂停

### Phase 1 完成标准
参见 [Phase 1 测试计划](./PHASE1_TEST_PLAN.md)

**核心验收标准：**
1. ✅ 代码骨架完成
2. ✅ Docker Compose 基础设施可正常启动
3. ✅ data-ingestion 能从 Etherscan 获取数据并发送到 Kafka
4. ✅ stream-processor 能消费 Kafka 并写入 PostgreSQL
5. ✅ 端到端数据流验证通过 (9000+ transfers 已入库)

---

## Phase 1: 核心数据流

### 1.1 基础设施搭建
| 任务                  | 状态 | 备注                                    |
| --------------------- | ---- | --------------------------------------- |
| Docker Compose 配置   | ✅    | docker-compose.yml                      |
| PostgreSQL 初始化脚本 | ✅    | infra/init-scripts/postgres/01-init.sql |
| Prometheus 配置       | ✅    | infra/prometheus/prometheus.yml         |
| Grafana 配置          | ✅    | infra/grafana/provisioning/             |
| 项目目录结构          | ✅    | scripts/init-project.sh                 |
| Kafka Exporter        | ✅    | 监控 Kafka broker/topic/consumer lag    |
| PostgreSQL Exporter   | ✅    | 监控 PostgreSQL 性能指标                |
| Grafana Dashboard     | ✅    | Data Pipeline Overview 仪表盘           |
| Sparse Clone 脚本     | ✅    | scripts/sparse-clone.sh 轻量部署        |

### 1.2 数据采集服务 (Go)
| 任务                  | 状态 | 备注                          |
| --------------------- | ---- | ----------------------------- |
| Go modules 初始化     | ✅    | data-ingestion/go.mod         |
| 配置管理 (Viper)      | ✅    | internal/config/config.go     |
| 数据模型定义          | ✅    | internal/model/transaction.go |
| BlockchainClient 接口 | ✅    | internal/client/client.go     |
| Etherscan API 客户端  | ✅    | internal/client/etherscan.go  |
| Kafka Producer        | ✅    | internal/producer/kafka.go    |
| Ingestion Service     | ✅    | internal/service/ingestion.go |
| 主程序入口            | ✅    | cmd/ingestion/main.go         |
| Dockerfile            | ✅    | data-ingestion/Dockerfile     |
| 环境变量覆盖          | ✅    | 支持 KAFKA_BROKERS 等环境变量 |
| 单元测试              | 🔲    | 待补充                        |

### 1.3 流处理服务 (Java/Flink)
| 任务                                         | 状态 | 备注                                |
| -------------------------------------------- | ---- | ----------------------------------- |
| Maven 父模块配置                             | ✅    | processing/pom.xml                  |
| stream-processor pom.xml                     | ✅    | processing/stream-processor/pom.xml |
| 数据模型 (ChainEvent, Transaction, Transfer) | ✅    | model/*.java                        |
| Kafka 反序列化器                             | ✅    | parser/ChainEventDeserializer.java  |
| Transfer 解析器                              | ✅    | parser/TransferParser.java          |
| JDBC Sink 工厂                               | ✅    | sink/JdbcSinkFactory.java           |
| TransferExtractionJob                        | ✅    | job/TransferExtractionJob.java      |
| 主程序入口                                   | ✅    | StreamProcessorApp.java             |
| 配置文件                                     | ✅    | application.properties, logback.xml |
| batch-processor pom.xml                      | ✅    | 骨架已创建                          |
| graph-engine pom.xml                         | ✅    | 骨架已创建                          |
| 单元测试                                     | 🔲    | 待补充                              |

### 1.4 监控与可观测性
| 任务                    | 状态 | 备注                            |
| ----------------------- | ---- | ------------------------------- |
| kafka-exporter 部署     | ✅    | 监控 consumer lag, message rate |
| postgres-exporter 部署  | ✅    | 监控 TPS, connections, DB size  |
| Prometheus scrape 配置  | ✅    | infra/prometheus/prometheus.yml |
| Grafana Datasource 配置 | ✅    | 配置 uid 确保 dashboard 正常    |
| Data Pipeline Dashboard | ✅    | Kafka + PostgreSQL 核心指标     |
| Go 服务 metrics         | ⏸️    | 待容器化后添加                  |
| Flink metrics           | ⏸️    | 待容器化后添加                  |

---

## Phase 2: 查询与风险服务

### 2.1 Query Service (Go/Gin)
| 任务         | 状态 | 备注 |
| ------------ | ---- | ---- |
| 项目初始化   | 🔲    |      |
| GORM 模型    | 🔲    |      |
| 地址查询 API | 🔲    |      |
| 交易查询 API | 🔲    |      |
| Redis 缓存   | 🔲    |      |
| Swagger 文档 | 🔲    |      |

### 2.2 Risk ML Service (Python/FastAPI)
| 任务         | 状态 | 备注 |
| ------------ | ---- | ---- |
| 项目初始化   | 🔲    |      |
| FastAPI 结构 | 🔲    |      |
| 规则引擎     | 🔲    |      |
| 风险评分 API | 🔲    |      |
| 批量评分 API | 🔲    |      |

### 2.3 Orchestrator (Java/Spring Cloud)
| 任务              | 状态 | 备注 |
| ----------------- | ---- | ---- |
| Spring Cloud 搭建 | 🔲    |      |
| Nacos 注册        | 🔲    |      |
| 配置中心          | 🔲    |      |
| 网关路由          | 🔲    |      |

---

## Phase 3: BFF与前端

### 3.1 BFF Gateway (TypeScript/Nest.js)
| 任务           | 状态 | 备注 |
| -------------- | ---- | ---- |
| Nest.js 初始化 | 🔲    |      |
| JWT 认证       | 🔲    |      |
| API 聚合       | 🔲    |      |
| 限流中间件     | 🔲    |      |
| OpenAPI 文档   | 🔲    |      |

### 3.2 Frontend (React)
| 任务                | 状态 | 备注 |
| ------------------- | ---- | ---- |
| Vite + React 初始化 | 🔲    |      |
| 路由配置            | 🔲    |      |
| Dashboard 页面      | 🔲    |      |
| 地址查询页          | 🔲    |      |
| 风险分析页          | 🔲    |      |

### 3.3 部署
| 任务     | 状态 | 备注 |
| -------- | ---- | ---- |
| K8s YAML | 🔲    |      |
| Ingress  | 🔲    |      |
| 监控配置 | 🔲    |      |

---

## Phase 4: 高级功能

### 4.1 Graph Engine
| 任务            | 状态 | 备注 |
| --------------- | ---- | ---- |
| Neo4j 集成      | 🔲    |      |
| 地址聚类        | 🔲    |      |
| Tag Propagation | 🔲    |      |

### 4.2 ML 风险模型
| 任务         | 状态 | 备注 |
| ------------ | ---- | ---- |
| 特征工程     | 🔲    |      |
| XGBoost 模型 | 🔲    |      |
| 模型服务化   | 🔲    |      |

### 4.3 批处理
| 任务       | 状态 | 备注 |
| ---------- | ---- | ---- |
| 每日批处理 | 🔲    |      |
| 流批合并   | 🔲    |      |

### 4.4 Alert Service
| 任务     | 状态 | 备注 |
| -------- | ---- | ---- |
| 规则引擎 | 🔲    |      |
| 通知推送 | 🔲    |      |

---

## 📝 开发日志

### 2025-12-29
- ✅ 添加 kafka-exporter 和 postgres-exporter 监控
- ✅ 配置 Prometheus scrape targets
- ✅ 创建 Grafana Data Pipeline Overview Dashboard
- ✅ 修复 Grafana datasource uid 配置问题
- ✅ 修复 Kafka advertised.listeners 配置（需要设置 DOCKER_HOST_IP）
- ✅ 端到端数据流验证通过（9000+ transfers 入库）
- ✅ 添加 sparse-clone.sh 轻量部署脚本
- ✅ 添加 DEPLOY_FILES.txt 部署文件清单
- ✅ **Phase 1 完成！**

### 2025-12-26
- ✅ 完成项目规划
- ✅ 创建项目文档结构
- ✅ 创建 Docker Compose 配置
- ✅ 创建项目初始化脚本
- ✅ 创建 Git 管理配置 (CI/CD, Makefile, .gitignore)
- ✅ 完成 data-ingestion (Go) 服务骨架
- ✅ 完成 stream-processor (Java/Flink) 服务骨架
- ✅ 更新数据库初始化脚本

---

## 🐛 已知问题

| ID  | 描述                                     | 优先级 | 状态   |
| --- | ---------------------------------------- | ------ | ------ |
| 1   | Flink checkpoint 偶尔超时                | 低     | 待优化 |
| 2   | Go/Flink 服务 metrics 待容器化后添加监控 | 低     | 待处理 |

---

## 💡 待办想法

- [ ] 考虑添加 GraphQL 支持
- [ ] 研究 GNN 模型用于风险评分
- [ ] 添加 Telegram Bot 告警通道
- [ ] 添加 ERC20 Transfer 事件日志解析
- [ ] 容器化 data-ingestion 和 stream-processor
