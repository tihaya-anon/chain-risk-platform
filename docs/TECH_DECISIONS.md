# Chain Risk Platform - 技术决策记录

> 记录项目中的重要技术决策及其原因

---

## TDR-001: 多语言微服务架构

### 决策
采用多语言微服务架构，而非单一语言技术栈

### 背景
- 项目有双重目标：展示 Crypto 合规能力 + 后端接单技术背书
- 需要展示多种语言的熟练度

### 语言分配

| 服务类型 | 语言选择           | 原因                           |
| -------- | ------------------ | ------------------------------ |
| 数据采集 | Go                 | 高并发、低资源占用             |
| 流处理   | Java/Flink         | 生态成熟、与工作经验一致       |
| 查询服务 | Go/Gin             | 高性能、快速开发               |
| 风险服务 | Python/FastAPI     | ML 生态、快速迭代              |
| 服务治理 | Java/Spring Cloud  | 企业级方案、功能完善           |
| BFF      | TypeScript/Nest.js | 前后端类型一致、GraphQL 支持好 |
| 前端     | React/TypeScript   | 生态丰富、类型安全             |

### 影响
- 增加了运维复杂度
- 需要统一的服务通信规范
- 需要完善的 CI/CD 支持

---

## TDR-002: 数据存储选型

### 决策
- 关系型数据：PostgreSQL
- 图数据：Neo4j
- 缓存：Redis
- 消息队列：Kafka

### 原因

#### PostgreSQL
- 开源、功能强大
- JSON 支持好，适合半结构化数据
- 扩展性好 (TimescaleDB, PostGIS)

#### Neo4j
- 图查询性能优秀
- Cypher 查询语言直观
- 适合地址关系和 Tag Propagation

#### Redis
- 高性能缓存
- 支持多种数据结构
- 可用于分布式锁、限流

#### Kafka
- 高吞吐量
- 持久化消息
- 与 Flink 集成好

---

## TDR-003: API 设计规范

### 决策
- 内部服务间：gRPC
- 对外 API：RESTful + OpenAPI
- BFF 层：可选 GraphQL

### 原因
- gRPC：高性能、强类型、代码生成
- REST：通用性好、调试方便
- GraphQL：前端灵活查询、减少请求次数

### 规范
```yaml
# RESTful API 命名规范
GET    /api/v1/addresses/:address        # 获取地址详情
GET    /api/v1/addresses/:address/transfers  # 获取地址交易
POST   /api/v1/risk/score                # 计算风险分
GET    /api/v1/alerts                    # 获取告警列表
```

---

## TDR-004: 服务治理方案

### 决策
使用 Spring Cloud 生态作为服务治理基础

### 组件选择

| 功能     | 组件                 | 备选                        |
| -------- | -------------------- | --------------------------- |
| 服务注册 | Nacos                | Consul, Eureka              |
| 配置中心 | Nacos                | Apollo, Spring Cloud Config |
| 网关     | Spring Cloud Gateway | Kong, APISIX                |
| 链路追踪 | Jaeger               | Zipkin, SkyWalking          |
| 监控     | Prometheus + Grafana | -                           |

### 原因
- Nacos：阿里开源，功能全面，中文文档好
- 与 Java 生态集成好
- 支持多语言 SDK

---

## TDR-005: 风险评分方案

### 决策
分阶段实现：规则引擎 → ML 模型

### Phase 1: 规则引擎
```python
# 基础规则示例
rules = [
    BlacklistRule(weight=1.0),      # 黑名单检查
    HighFrequencyRule(weight=0.3),  # 高频交易
    LargeAmountRule(weight=0.4),    # 大额交易
    MixerInteractionRule(weight=0.8) # 混币器交互
]
```

### Phase 2: ML 模型
- 特征：交易图特征、时序特征、行为特征
- 模型：XGBoost → GNN
- 服务：模型版本管理、A/B 测试

### 原因
- 规则引擎快速上线，可解释性强
- ML 模型提升准确率，但需要数据积累

---

## TDR-006: Tag Propagation 算法

### 决策
基于图的标签传播算法，带置信度衰减

### 算法设计
```
初始标签: 已知风险地址标记为 1.0
传播规则:
  - 直接交易: 置信度 × 0.8
  - 二度关联: 置信度 × 0.6
  - 三度关联: 置信度 × 0.4
  - 超过三度: 不传播

聚合规则:
  - 多个来源取最大值
  - 或加权平均
```

### 实现方式
- 使用 Neo4j 存储图结构
- Cypher 查询实现传播
- 定期批量更新

---

## TDR-007: 流批一体处理

### 决策
- 实时流：Flink DataStream
- 批处理：Flink SQL
- 批处理结果覆盖流处理结果

### 数据流
```
链上数据 → Kafka → Flink Stream → 实时表
                         ↓
              Flink SQL (每日) → 覆盖实时表
```

### 原因
- 与当前工作经验一致
- Flink 流批一体，技术栈统一
- 批处理保证数据最终一致性

---

## TDR-008: 部署方案

### 决策
- 开发环境：Docker Compose
- 生产环境：Kubernetes

### K8s 资源规划
```yaml
# 初始资源配置
services:
  bff-gateway:      { replicas: 2, cpu: 500m, memory: 512Mi }
  query-service:    { replicas: 2, cpu: 500m, memory: 512Mi }
  risk-ml-service:  { replicas: 2, cpu: 1000m, memory: 1Gi }
  alert-service:    { replicas: 2, cpu: 500m, memory: 512Mi }
  
processing:
  stream-processor: { replicas: 1, cpu: 2000m, memory: 4Gi }
  
databases:
  postgresql:       { replicas: 1, cpu: 1000m, memory: 2Gi }
  redis:            { replicas: 1, cpu: 500m, memory: 1Gi }
  kafka:            { replicas: 3, cpu: 1000m, memory: 2Gi }
```

---

## 📝 决策模板

```markdown
## TDR-XXX: [决策标题]

### 决策
[简要描述决策内容]

### 背景
[为什么需要做这个决策]

### 选项
1. 选项A: ...
2. 选项B: ...
3. 选项C: ...

### 决策原因
[为什么选择这个方案]

### 影响
[这个决策带来的影响]

### 日期
[决策日期]
```
