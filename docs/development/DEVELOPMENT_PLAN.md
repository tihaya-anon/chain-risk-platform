# Chain Risk Platform - 开发计划

## 🚀 MVP 分阶段计划

---

## Phase 1: 核心数据流 (预计 2-3 周) ✅ 已完成

### 目标
跑通 `链上数据 → Kafka → Flink → DB` 的完整链路

### 任务清单

#### 1.1 基础设施搭建
- [x] Docker Compose 环境配置
  - [x] Kafka + Zookeeper
  - [x] PostgreSQL
  - [x] Redis (缓存)
- [x] 项目骨架初始化
  - [x] 各服务目录结构
  - [x] CI/CD 基础配置

#### 1.2 数据采集服务 (Go)
- [x] 项目初始化 (Go modules)
- [x] Etherscan API 客户端封装
- [x] 区块轮询逻辑
- [x] Kafka Producer 实现
- [x] 配置管理 (Viper)
- [x] 基础日志和监控
- [x] **重构: 抽离统一 Fetcher 层** ✨ 新增
  - [x] 创建 internal/fetcher 包（原始 API 数据获取）
  - [x] 创建 internal/parser 包（数据解析）
  - [x] 创建 internal/storage 包（数据持久化）
  - [x] 重构 EtherscanClient 使用 fetcher + parser
  - [x] 支持 Etherscan API V2 (chainid 参数)

#### 1.3 流处理服务 (Java/Flink)
- [x] Flink 项目搭建
- [x] Kafka Consumer 配置
- [x] Transaction → Transfer 解析逻辑
- [x] PostgreSQL Sink
- [x] 基础窗口聚合

#### 1.4 集成测试 ✅ 已完成
- [x] **Mock Etherscan Server** ✨ 新增
  - [x] 支持从 fixtures 加载真实 API 数据
  - [x] 支持 fallback 生成模拟数据
  - [x] 提供完整的 Etherscan API 兼容接口
- [x] **Fixture Generator 工具** ✨ 新增
  - [x] 从真实 Etherscan API 获取数据
  - [x] 保存为 JSON fixtures 供测试使用
  - [x] 支持获取 blocks、addresses、internal_txs
  - [x] 生成 manifest.json 索引文件
- [x] **端到端集成测试脚本**
  - [x] 自动化测试流程
  - [x] 支持远程 Docker 环境
  - [x] 数据验证和报告生成
- [x] **测试通过验证** ✅
  - [x] Mock Server 正常运行
  - [x] Data Ingestion 成功采集数据
  - [x] Kafka 消息正常传输
  - [x] Flink 处理并写入 PostgreSQL
  - [x] 数据完整性验证通过

### 交付物
- ✅ 可运行的数据采集 → 存储链路
- ✅ 基础的 Transfer 数据表
- ✅ **完整的集成测试框架** ✨ 新增
- ✅ **可复用的测试 fixtures** ✨ 新增
- ✅ **重构后的 data-ingestion 架构** ✨ 新增

### 最近更新 (2026-01-02)
- ✅ 完成 data-ingestion 重构，抽离 fetcher/parser/storage 层
- ✅ 实现 fixture-gen 工具，可从真实 API 生成测试数据
- ✅ 实现 Mock Etherscan Server，支持集成测试
- ✅ 集成测试全流程通过验证
- ✅ 升级到 Etherscan API V2
- ✅ 消除约 200 行重复代码，提升可维护性

---

## Phase 2: 查询与风险服务 (预计 2-3 周) 🔶 进行中 (85%)

### 目标
提供基础查询 API 和简单风险评分

### 任务清单

#### 2.1 Query Service (Go/Gin)
- [x] 项目初始化
- [x] GORM 数据模型定义
- [x] RESTful API 设计
  - [x] GET /addresses/:address - 地址详情
  - [x] GET /addresses/:address/transfers - 地址交易记录
  - [x] GET /addresses/:address/stats - 地址统计
  - [x] GET /transfers - 交易列表 (分页)
- [ ] Redis 缓存层
- [x] Swagger 文档 (godoc 注释)
- [x] Nacos 集成 ✨ 已完成

#### 2.2 Risk ML Service (Python/FastAPI)
- [x] 项目初始化 (pyproject.toml/uv)
- [x] FastAPI 基础结构
- [x] 规则引擎 (初版，基于规则)
  - [x] 黑名单检查
  - [x] 交易频率异常
  - [x] 大额交易检测
  - [x] 新地址检测
  - [x] 整数金额检测
- [x] API 设计
  - [x] POST /risk/score - 地址风险评分
  - [x] POST /risk/batch - 批量评分
  - [x] GET /risk/rules - 规则列表
- [ ] 预留 ML 模型接口
- [x] Nacos 集成 ✨ 已完成

#### 2.3 Orchestrator (Java/Spring Cloud Gateway)
- [x] Spring Cloud 项目搭建
- [x] API Gateway 路由 (Spring Cloud Gateway)
- [x] JWT 认证过滤器 (AuthenticationFilter)
- [x] 用户上下文注入 (X-User-Id/Username/Role)
- [x] 熔断器 (Resilience4j Circuit Breaker)
- [x] 限流 (Rate Limiting)
- [x] 请求日志 (LoggingFilter)
- [x] Fallback 降级处理
- [x] API 编排 (OrchestrationController)
- [x] Nacos 服务注册与发现 ✨ 已完成
- [x] Nacos 配置中心 ✨ 已完成

### 交付物
- ✅ 可查询的地址/交易 API (基础功能)
- ✅ 基础风险评分能力 (规则引擎)
- ✅ API Gateway (认证、路由、熔断、限流)
- ✅ **Nacos 服务治理集成** ✨ 已完成

---

## Phase 3: BFF 与前端 (预计 2 周) 🔶 进行中 (80%)

### 目标
完整可演示的产品

### 任务清单

#### 3.1 BFF (TypeScript/Nest.js)
- [x] Nest.js 项目初始化
- [x] Gateway 信任模式 (信任 Orchestrator 注入的用户上下文)
- [x] GatewayAuthGuard (从请求头提取用户信息)
- [x] API 聚合层
  - [x] 整合 Query Service (AddressModule)
  - [x] 整合 Risk Service (RiskModule)
  - [x] 整合 Graph Service (GraphModule)
- [x] 限流中间件 (备用，主要由 Orchestrator 处理)
- [ ] GraphQL (可选)
- [x] OpenAPI 文档
- [x] Dockerfile
- [x] Nacos 集成 ✨ 已完成

**注意**: JWT 认证已移至 Orchestrator (Java)，BFF 完全信任 Gateway 转发的用户上下文。

#### 3.2 Frontend (React)
- [x] Vite + React + TypeScript 初始化
- [x] 基础布局和路由
- [x] 状态管理 (Zustand)
- [x] API 服务层
- [x] Mock 数据 (MSW)
- [x] 页面开发
  - [x] Dashboard 概览 (DashboardPage)
  - [x] 地址查询页 (AddressPage)
  - [x] 风险分析页 (RiskPage)
  - [x] 登录页 (LoginPage)
  - [x] 图谱探索页 (GraphExplorerPage)
  - [x] 高风险网络页 (HighRiskNetworkPage)
  - [x] 路径查找页 (PathFinderPage)
  - [x] Tag 搜索页 (TagSearchPage)
  - [x] 管理页面 (AdminPage)
- [ ] 图表组件 (ECharts/Recharts) - 待完善
- [ ] 响应式设计 - 待完善

#### 3.3 部署配置
- [ ] K8s 部署 YAML
- [ ] Ingress 配置
- [ ] 基础监控 (Prometheus + Grafana)

### 交付物
- ✅ 基础可演示的 Web 应用 (已完成基础功能)
- [ ] K8s 部署方案

---

## Phase 4: 高级功能 (持续迭代) 🔶 进行中 (40%)

### 目标
增强核心竞争力功能

### 任务清单

#### 4.1 Graph Engine (Java/Spring Boot + Neo4j) ✅ 已完成
- [x] Neo4j 集成
  - [x] Neo4jConfig 配置
  - [x] Neo4jConverters (Long ↔ Instant 类型转换)
- [x] 地址聚类算法
  - [x] 基于共同输入的聚类 (CommonInputClusteringService)
  - [x] Union-Find 算法实现
- [x] Tag Propagation 实现
  - [x] BFS 风险标签传播 (BfsTagPropagationService)
  - [x] 置信度衰减
- [x] 图查询 API (GraphController)
  - [x] 地址信息查询 (GET /api/graph/address/{address})
  - [x] 邻居查询 (GET /api/graph/address/{address}/neighbors)
  - [x] 最短路径查询 (GET /api/graph/path/{from}/{to})
  - [x] 集群查询 (GET /api/graph/address/{address}/cluster, GET /api/graph/cluster/{id})
  - [x] Tag 管理 (GET/POST/DELETE)
  - [x] 高风险地址搜索 (GET /api/graph/search/high-risk)
  - [x] Tag 搜索 (GET /api/graph/search/tag/{tag})
- [x] PostgreSQL 数据同步 (GraphSyncService)
- [x] OpenAPI 文档 (Swagger 注解)

#### 4.2 ML 风险模型 (Python)
- [ ] 特征工程
  - [ ] 交易图特征
  - [ ] 时序特征
  - [ ] 行为特征
- [ ] 模型训练
  - [ ] XGBoost 基线
  - [ ] GNN 模型 (可选)
- [ ] 模型服务化
- [ ] A/B 测试框架

#### 4.3 批处理 (Java/Flink SQL)
- [x] 项目骨架创建
- [ ] 每日批处理作业
- [ ] 流批结果合并逻辑
- [ ] 数据质量检查

#### 4.4 Alert Service (Go)
- [x] 项目骨架创建
- [ ] 告警规则引擎
- [ ] 多渠道通知
  - [ ] Email
  - [ ] Webhook
  - [ ] Telegram
- [ ] 告警聚合和去重

### 交付物
- ✅ Graph Engine 完整功能
- [ ] 完整的风险分析能力 (ML)
- [ ] 生产级的告警系统

---

## 📅 时间线总览

```
Week 1-3:   Phase 1 - 核心数据流 ✅ (含集成测试和重构)
Week 4-6:   Phase 2 - 查询与风险服务 🔶 (85% 完成，含 Nacos 集成)
Week 7-8:   Phase 3 - BFF与前端 🔶 (80% 完成)
Week 9+:    Phase 4 - 高级功能 🔶 (40% 完成，Graph Engine 已完成)
```

---

## ✅ 里程碑检查点

| 里程碑 | 预计时间 | 验收标准                    | 状态                  |
| ------ | -------- | --------------------------- | --------------------- |
| M1     | Week 3   | 数据能从链上采集并存入 DB   | ✅ 已完成 (含集成测试) |
| M2     | Week 6   | 能通过 API 查询地址和风险分 | ✅ 已完成 (含 Nacos)   |
| M3     | Week 8   | 完整 Demo 可演示            | 🔶 80% 完成            |
| M4     | Week 12  | Graph + ML 功能上线         | 🔶 Graph 已完成        |

---

## 📝 最近更新记录

### 2026-01-02
- ✅ **Phase 1 集成测试完成**
  - 实现 Mock Etherscan Server（支持 fixtures 和 fallback 模式）
  - 实现 fixture-gen 工具（从真实 API 生成测试数据）
  - 端到端集成测试全流程通过
  - 生成 214 个内部交易 fixtures
  
- ✅ **Data Ingestion 重构完成**
  - 抽离 internal/fetcher 包（统一 API 数据获取）
  - 抽离 internal/parser 包（数据解析）
  - 抽离 internal/storage 包（数据持久化）
  - 升级到 Etherscan API V2
  - 消除约 200 行重复代码
  - 提升代码可维护性和可测试性

- ✅ **Nacos 集成完成**
  - 所有服务（Go/Java/Python/TypeScript）集成 Nacos
  - 服务注册与发现
  - 配置中心集成
  - 动态配置更新

### 之前更新
- ✅ Graph Engine 完整功能实现
- ✅ Frontend 基础页面开发完成
- ✅ Orchestrator API Gateway 完成
- ✅ BFF 聚合层完成

---

## 📝 备注

- 每个 Phase 完成后进行代码 Review 和文档更新
- 优先保证核心链路稳定，再扩展功能
- 保持代码质量，写好单元测试
- **重点关注代码复用和架构优化** ✨
