# Chain Risk Platform - 开发计划

## 🚀 MVP 分阶段计划

---

## Phase 1: 核心数据流 (预计 2-3 周)

### 目标
跑通 `链上数据 → Kafka → Flink → DB` 的完整链路

### 任务清单

#### 1.1 基础设施搭建
- [ ] Docker Compose 环境配置
  - [ ] Kafka + Zookeeper
  - [ ] PostgreSQL
  - [ ] Redis (缓存)
- [ ] 项目骨架初始化
  - [ ] 各服务目录结构
  - [ ] CI/CD 基础配置

#### 1.2 数据采集服务 (Go)
- [ ] 项目初始化 (Go modules)
- [ ] Etherscan API 客户端封装
- [ ] 区块轮询逻辑
- [ ] Kafka Producer 实现
- [ ] 配置管理 (Viper)
- [ ] 基础日志和监控

#### 1.3 流处理服务 (Java/Flink)
- [ ] Flink 项目搭建
- [ ] Kafka Consumer 配置
- [ ] Transaction → Transfer 解析逻辑
- [ ] PostgreSQL Sink
- [ ] 基础窗口聚合

### 交付物
- 可运行的数据采集 → 存储链路
- 基础的 Transfer 数据表

---

## Phase 2: 查询与风险服务 (预计 2-3 周)

### 目标
提供基础查询 API 和简单风险评分

### 任务清单

#### 2.1 Query Service (Go/Gin)
- [ ] 项目初始化
- [ ] GORM 数据模型定义
- [ ] RESTful API 设计
  - [ ] GET /addresses/:address - 地址详情
  - [ ] GET /addresses/:address/transfers - 地址交易记录
  - [ ] GET /transfers - 交易列表 (分页)
- [ ] Redis 缓存层
- [ ] Swagger 文档

#### 2.2 Risk ML Service (Python/FastAPI)
- [ ] 项目初始化 (Poetry/PDM)
- [ ] FastAPI 基础结构
- [ ] 规则引擎 (初版，基于规则)
  - [ ] 黑名单检查
  - [ ] 交易频率异常
  - [ ] 大额交易检测
- [ ] API 设计
  - [ ] POST /risk/score - 地址风险评分
  - [ ] POST /risk/batch - 批量评分
- [ ] 预留 ML 模型接口

#### 2.3 Orchestrator (Java/Spring Cloud)
- [ ] Spring Cloud 项目搭建
- [ ] Nacos/Consul 服务注册
- [ ] 配置中心
- [ ] 基础网关路由

### 交付物
- 可查询的地址/交易 API
- 基础风险评分能力

---

## Phase 3: BFF 与前端 (预计 2 周)

### 目标
完整可演示的产品

### 任务清单

#### 3.1 BFF Gateway (TypeScript/Nest.js)
- [ ] Nest.js 项目初始化
- [ ] JWT 认证模块
- [ ] API 聚合层
  - [ ] 整合 Query Service
  - [ ] 整合 Risk Service
- [ ] 限流中间件
- [ ] GraphQL (可选)
- [ ] OpenAPI 文档

#### 3.2 Frontend (React)
- [ ] Vite + React + TypeScript 初始化
- [ ] 基础布局和路由
- [ ] 页面开发
  - [ ] Dashboard 概览
  - [ ] 地址查询页
  - [ ] 风险分析页
- [ ] 图表组件 (ECharts/Recharts)
- [ ] 响应式设计

#### 3.3 部署配置
- [ ] K8s 部署 YAML
- [ ] Ingress 配置
- [ ] 基础监控 (Prometheus + Grafana)

### 交付物
- 完整可演示的 Web 应用
- K8s 部署方案

---

## Phase 4: 高级功能 (持续迭代)

### 目标
增强核心竞争力功能

### 任务清单

#### 4.1 Graph Engine (Java)
- [ ] Neo4j 集成
- [ ] 地址聚类算法
  - [ ] 基于共同输入的聚类
  - [ ] 基于行为模式的聚类
- [ ] Tag Propagation 实现
  - [ ] 风险标签传播
  - [ ] 置信度衰减
- [ ] 图查询 API

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
Week 1-3:   Phase 1 - 核心数据流
Week 4-6:   Phase 2 - 查询与风险服务
Week 7-8:   Phase 3 - BFF与前端
Week 9+:    Phase 4 - 高级功能 (持续)
```

---

## ✅ 里程碑检查点

| 里程碑 | 预计时间 | 验收标准 |
|--------|----------|----------|
| M1 | Week 3 | 数据能从链上采集并存入 DB |
| M2 | Week 6 | 能通过 API 查询地址和风险分 |
| M3 | Week 8 | 完整 Demo 可演示 |
| M4 | Week 12 | Graph + ML 功能上线 |

---

## 📝 备注

- 每个 Phase 完成后进行代码 Review 和文档更新
- 优先保证核心链路稳定，再扩展功能
- 保持代码质量，写好单元测试
