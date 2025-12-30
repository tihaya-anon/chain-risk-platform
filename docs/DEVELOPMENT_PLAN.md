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

#### 1.3 流处理服务 (Java/Flink)
- [x] Flink 项目搭建
- [x] Kafka Consumer 配置
- [x] Transaction → Transfer 解析逻辑
- [x] PostgreSQL Sink
- [x] 基础窗口聚合

### 交付物
- ✅ 可运行的数据采集 → 存储链路
- ✅ 基础的 Transfer 数据表

---

## Phase 2: 查询与风险服务 (预计 2-3 周) 🔶 进行中

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
- [ ] Nacos/Consul 服务注册
- [ ] 配置中心

### 交付物
- ✅ 可查询的地址/交易 API (基础功能)
- ✅ 基础风险评分能力 (规则引擎)
- ✅ API Gateway (认证、路由、熔断、限流)

---

## Phase 3: BFF 与前端 (预计 2 周) 🔶 进行中

### 目标
完整可演示的产品

### 任务清单

#### 3.1 BFF (TypeScript/Nest.js)
- [x] Nest.js 项目初始化
- [x] Gateway 信任模式 (信任 Orchestrator 注入的用户上下文)
- [x] GatewayAuthGuard (从请求头提取用户信息)
- [x] API 聚合层
  - [x] 整合 Query Service
  - [x] 整合 Risk Service
- [x] 限流中间件 (备用，主要由 Orchestrator 处理)
- [ ] GraphQL (可选)
- [x] OpenAPI 文档

**注意**: JWT 认证已移至 Orchestrator (Java)，BFF 完全信任 Gateway 转发的用户上下文。

#### 3.2 Frontend (React)
- [x] Vite + React + TypeScript 初始化
- [x] 基础布局和路由
- [x] 页面开发
  - [x] Dashboard 概览
  - [x] 地址查询页
  - [x] 风险分析页
  - [x] 登录页
- [ ] 图表组件 (ECharts/Recharts) - 待完善
- [ ] 响应式设计 - 待完善

#### 3.3 部署配置
- [ ] K8s 部署 YAML
- [ ] Ingress 配置
- [ ] 基础监控 (Prometheus + Grafana)

### 交付物
- 🔶 基础可演示的 Web 应用 (已完成基础功能)
- [ ] K8s 部署方案

---

## Phase 4: 高级功能 (持续迭代)

### 目标
增强核心竞争力功能

### 任务清单

#### 4.1 Graph Engine (Java) ✅ 已完成
- [x] Neo4j 集成
- [x] 地址聚类算法
  - [x] 基于共同输入的聚类 (CommonInputClusteringService)
  - [x] Union-Find 算法实现
- [x] Tag Propagation 实现
  - [x] BFS 风险标签传播 (BfsTagPropagationService)
  - [x] 置信度衰减
- [x] 图查询 API
  - [x] 地址信息查询
  - [x] 邻居查询
  - [x] 最短路径查询
  - [x] 集群查询
- [x] PostgreSQL 数据同步 (GraphSyncService)
- [x] 自定义 Neo4j 类型转换器 (Long ↔ Instant)

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
- [ ] 每日批处理作业
- [ ] 流批结果合并逻辑
- [ ] 数据质量检查

#### 4.4 Alert Service (Go)
- [ ] 告警规则引擎
- [ ] 多渠道通知
  - [ ] Email
  - [ ] Webhook
  - [ ] Telegram
- [ ] 告警聚合和去重

### 交付物
- 完整的风险分析能力
- 生产级的告警系统

---

## 📅 时间线总览

```
Week 1-3:   Phase 1 - 核心数据流 ✅
Week 4-6:   Phase 2 - 查询与风险服务 🔶 (基础功能已完成)
Week 7-8:   Phase 3 - BFF与前端 🔶 (基础功能已完成)
Week 9+:    Phase 4 - 高级功能 (持续)
```

---

## ✅ 里程碑检查点

| 里程碑 | 预计时间 | 验收标准                    | 状态             |
| ------ | -------- | --------------------------- | ---------------- |
| M1     | Week 3   | 数据能从链上采集并存入 DB   | ✅ 已完成         |
| M2     | Week 6   | 能通过 API 查询地址和风险分 | ✅ 基础功能已完成 |
| M3     | Week 8   | 完整 Demo 可演示            | 🔶 基础功能已完成 |
| M4     | Week 12  | Graph + ML 功能上线         | 🔲 未开始         |

---

## 📝 备注

- 每个 Phase 完成后进行代码 Review 和文档更新
- 优先保证核心链路稳定，再扩展功能
- 保持代码质量，写好单元测试
