# 开发进度追踪

> 最后更新: 2026-01-02

## 📊 总体进度

| Phase                   | 状态     | 进度 | 说明                                      |
| ----------------------- | -------- | ---- | ----------------------------------------- |
| Phase 1: 核心数据流     | ✅ 已完成 | 100% | 端到端数据流验证通过，监控已配置          |
| Phase 2: 查询与风险服务 | 🔶 进行中 | 85%  | 核心功能已完成，缺少缓存和测试            |
| Phase 3: BFF与前端      | 🔶 进行中 | 80%  | 基础功能已完成，待完善图表和响应式        |
| Phase 4: 高级功能       | 🔶 进行中 | 40%  | Graph Engine 已完成，ML/批处理/告警待开发 |

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
| Transaction 解析器                           | ✅    | parser/TransactionParser.java       |
| JDBC Sink 工厂                               | ✅    | sink/JdbcSinkFactory.java           |
| Transaction Sink                             | ✅    | 写入 chain_data.transactions        |
| Processing State Tracker                     | ✅    | 写入 chain_data.processing_state    |
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
| 任务              | 状态 | 备注                               |
| ----------------- | ---- | ---------------------------------- |
| 项目初始化        | ✅    | go.mod 已配置                      |
| GORM 模型         | ✅    | internal/model/ 已完成             |
| 地址查询 API      | ✅    | GET /addresses/:address            |
| 交易查询 API      | ✅    | GET /addresses/:address/transfers  |
| 地址统计 API      | ✅    | GET /addresses/:address/stats      |
| Transfer 查询 API | ✅    | GET /transfers, GET /transfers/:id |
| Redis 缓存        | 🔲    | 待实现                             |
| Swagger 文档      | ✅    | godoc 注释已添加                   |
| 单元测试          | 🔲    | 待补充                             |

### 2.2 Risk ML Service (Python/FastAPI)
| 任务         | 状态 | 备注                            |
| ------------ | ---- | ------------------------------- |
| 项目初始化   | ✅    | pyproject.toml 已配置           |
| FastAPI 结构 | ✅    | app/ 目录结构完整               |
| 规则引擎     | ✅    | 5种风险规则已实现               |
| 风险评分 API | ✅    | POST /api/v1/risk/score         |
| 批量评分 API | ✅    | POST /api/v1/risk/batch         |
| 规则列表 API | ✅    | GET /api/v1/risk/rules          |
| Query 客户端 | ✅    | 调用 query-service 获取地址数据 |
| ML 模型集成  | 🔲    | 待实现                          |
| 单元测试     | 🔲    | 待补充                          |

### 2.3 Orchestrator (Java/Spring Cloud Gateway)
| 任务                  | 状态 | 备注                           |
| --------------------- | ---- | ------------------------------ |
| Spring Cloud 搭建     | ✅    | pom.xml 已配置                 |
| API Gateway 路由      | ✅    | Spring Cloud Gateway 路由配置  |
| JWT 认证过滤器        | ✅    | AuthenticationFilter 已实现    |
| 用户上下文注入        | ✅    | X-User-Id/Username/Role 请求头 |
| 熔断器 (Resilience4j) | ✅    | Circuit Breaker 已配置         |
| 限流 (Rate Limiting)  | ✅    | Rate Limiter 已配置            |
| 请求日志              | ✅    | LoggingFilter 已实现           |
| Fallback 降级         | ✅    | FallbackController 已实现      |
| API 编排              | ✅    | OrchestrationController 已实现 |
| Nacos 服务注册        | ⏸️    | 代码已准备，待配置启用         |
| 配置中心              | ⏸️    | 代码已准备，待配置启用         |
| 单元测试              | 🔲    | 待补充                         |

---

## Phase 3: BFF与前端

### 3.1 BFF (TypeScript/Nest.js)
| 任务             | 状态 | 备注                               |
| ---------------- | ---- | ---------------------------------- |
| Nest.js 初始化   | ✅    | 项目结构完整                       |
| Gateway 信任模式 | ✅    | 信任 Orchestrator 注入的用户上下文 |
| GatewayAuthGuard | ✅    | 从请求头提取用户信息               |
| API 聚合         | ✅    | AddressModule, RiskModule          |
| 限流中间件       | ✅    | ThrottlerModule 已配置 (备用)      |
| OpenAPI 文档     | ✅    | Swagger UI 已集成                  |
| CORS 配置        | ✅    | 已配置                             |
| Dockerfile       | ✅    | 已创建                             |
| 单元测试         | 🔲    | 待补充                             |

**注意**: JWT 认证已移至 Orchestrator (Java)，BFF 完全信任 Gateway 转发的用户上下文。

### 3.2 Frontend (React)
| 任务                | 状态 | 备注                      |
| ------------------- | ---- | ------------------------- |
| Vite + React 初始化 | ✅    | TypeScript 配置完整       |
| 路由配置            | ✅    | react-router-dom 已配置   |
| 状态管理            | ✅    | Zustand (auth store)      |
| API 服务层          | ✅    | services/ 目录已实现      |
| 登录页面            | ✅    | LoginPage                 |
| Dashboard 页面      | ✅    | DashboardPage             |
| 地址查询页          | ✅    | AddressPage               |
| 风险分析页          | ✅    | RiskPage                  |
| Layout 组件         | ✅    | 已实现                    |
| Mock 数据           | ✅    | MSW (Mock Service Worker) |
| 图表组件            | 🔲    | 待完善                    |
| 响应式设计          | 🔲    | 待完善                    |

### 3.3 部署
| 任务     | 状态 | 备注   |
| -------- | ---- | ------ |
| K8s YAML | 🔲    | 待实现 |
| Ingress  | 🔲    | 待实现 |
| 监控配置 | 🔲    | 待实现 |

---

## Phase 4: 高级功能

### 4.1 Graph Engine (Java/Spring Boot + Neo4j)
| 任务                | 状态 | 备注                                              |
| ------------------- | ---- | ------------------------------------------------- |
| Neo4j 集成          | ✅    | Neo4jConfig, Neo4jConverters 已配置               |
| 地址聚类算法        | ✅    | CommonInputClusteringService (Union-Find)         |
| Tag Propagation     | ✅    | BfsTagPropagationService (BFS + 置信度衰减)       |
| 图查询服务          | ✅    | GraphQueryServiceImpl 已实现                      |
| PostgreSQL 数据同步 | ✅    | GraphSyncServiceImpl 已实现                       |
| REST API            | ✅    | GraphController 完整API                           |
| - 地址信息查询      | ✅    | GET /api/graph/address/{address}                  |
| - 邻居查询          | ✅    | GET /api/graph/address/{address}/neighbors        |
| - 集群查询          | ✅    | GET /api/graph/address/{address}/cluster          |
| - 最短路径查询      | ✅    | GET /api/graph/path/{from}/{to}                   |
| - Tag 管理          | ✅    | GET/POST/DELETE /api/graph/address/{address}/tags |
| - 高风险地址搜索    | ✅    | GET /api/graph/search/high-risk                   |
| - Tag 搜索          | ✅    | GET /api/graph/search/tag/{tag}                   |
| - 聚类触发          | ✅    | POST /api/graph/cluster/run                       |
| - 传播触发          | ✅    | POST /api/graph/propagate                         |
| - 同步状态/触发     | ✅    | GET/POST /api/graph/sync                          |
| OpenAPI 文档        | ✅    | Swagger 注解已添加                                |
| 单元测试            | 🔲    | 待补充                                            |

### 4.2 ML 风险模型
| 任务         | 状态 | 备注 |
| ------------ | ---- | ---- |
| 特征工程     | 🔲    |      |
| XGBoost 模型 | 🔲    |      |
| 模型服务化   | 🔲    |      |

### 4.3 批处理 (Java/Flink SQL)
| 任务       | 状态 | 备注           |
| ---------- | ---- | -------------- |
| 项目骨架   | ✅    | pom.xml 已创建 |
| 每日批处理 | 🔲    |                |
| 流批合并   | 🔲    |                |

### 4.4 Alert Service (Go/Gin)
| 任务     | 状态 | 备注             |
| -------- | ---- | ---------------- |
| 项目骨架 | ✅    | 目录结构已创建   |
| 规则引擎 | 🔲    | internal/ 待实现 |
| 通知推送 | 🔲    | notifier/ 待实现 |

---

## 📝 开发日志

### 2025-12-31
- 📝 全面更新开发进度文档，反映各微服务实际完成状态
- ✅ 确认 Graph Engine 已完成（聚类、传播、查询、同步）
- 📊 更新总体进度：Phase 2 (85%), Phase 3 (80%), Phase 4 (40%)

### 2025-12-30
- 📝 更新开发进度文档，反映 Phase 2/3 实际完成状态
- ✅ Phase 4B: Flink 添加 Transaction Sink
- ✅ Phase 4B: Flink 添加 Processing State Tracker
- 🔶 开始 Phase 4C: Graph Engine

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
