# Chain Risk Platform - 文档中心

> 本文档中心包含项目的所有技术文档，按照不同类别进行组织

## 📚 文档导航

### 🏗️ 架构设计 (Architecture)

系统架构、技术选型和设计决策相关文档

- **[项目总览](./architecture/PROJECT_OVERVIEW.md)** - 项目目标、技术栈、Lambda 架构总览
- **[Lambda 架构详解](./architecture/LAMBDA_ARCHITECTURE.md)** - 流批一体处理设计与实现（⭐ 新增）
- **[网关与BFF架构](./architecture/GATEWAY_BFF_ARCHITECTURE.md)** - Orchestrator和BFF的职责划分与请求流程
- **[Orchestrator架构](./architecture/ORCHESTRATOR_ARCHITECTURE.md)** - API网关与编排服务的统一架构设计
- **[技术决策记录](./architecture/TECH_DECISIONS.md)** - 重要技术决策及其原因（TDR）

### 📅 开发计划 (Development)

项目开发计划、进度追踪和测试计划

- **[开发计划](./development/DEVELOPMENT_PLAN.md)** - MVP分阶段开发计划和任务清单
- **[开发进度](./development/PROGRESS.md)** - 实时更新的开发进度追踪
- **[Phase 1 测试计划](./development/PHASE1_TEST_PLAN.md)** - 核心数据流的测试验证计划

### 🛠️ 操作手册 (Operations)

日常开发和运维操作指南

- **[脚本快速参考](./operations/SCRIPTS_QUICK_REFERENCE.md)** - 常用命令和脚本的快速查询手册
- **[脚本重构说明](./operations/SCRIPTS_REFACTORING.md)** - 脚本和Makefile的整理总结
- **[脚本整理对比](./operations/SCRIPTS_COMPARISON.md)** - 脚本整理前后的详细对比
- **[Git工作流指南](./operations/GIT_WORKFLOW.md)** - 分支策略、提交规范和发布流程
- **[Nacos集成指南](./operations/NACOS_INTEGRATION.md)** - 配置中心和服务注册与发现的使用指南

### 📡 API文档 (API Specs)

API规范管理和OpenAPI文档

- **[API规范管理指南](./api-specs/API_SPECS_GUIDE.md)** - 如何生成和更新各服务的API规范
- **[API规范快速参考](./api-specs/API_SPECS_QUICK_REF.md)** - API文档访问地址和快速命令
- **[OpenAPI规范文件](./api-specs/)** - 各微服务的OpenAPI JSON文件
  - `query-service.openapi.json` - Query Service (Go)
  - `bff.openapi.json` - BFF (NestJS)
  - `risk-ml-service.openapi.json` - Risk ML Service (FastAPI)
  - `orchestrator.openapi.json` - Orchestrator (Spring Boot)
  - `graph-engine.openapi.json` - Graph Engine (Spring Boot)

### 📝 变更记录 (Changelog)

项目变更历史和版本记录

- **[脚本变更日志](./changelog/CHANGELOG_SCRIPTS.md)** - 脚本和Makefile的变更历史
- **[文档重组变更日志](./changelog/CHANGELOG_DOCS_RESTRUCTURE.md)** - 文档目录结构重组记录

### 📦 归档文档 (Archive)

历史会话记录和过时文档

- **[会话归档 2024-12-30](./archive/SESSION_ARCHIVE_20241230.md)** - 集成测试框架搭建会话记录

---

## 🚀 快速开始

### 新手入门
1. 阅读 [项目总览](./architecture/PROJECT_OVERVIEW.md) 了解项目背景和架构
2. 阅读 [Lambda 架构详解](./architecture/LAMBDA_ARCHITECTURE.md) 理解流批一体处理
3. 查看 [开发计划](./development/DEVELOPMENT_PLAN.md) 了解当前开发阶段
4. 参考 [脚本快速参考](./operations/SCRIPTS_QUICK_REFERENCE.md) 启动开发环境

### 开发人员
1. 遵循 [Git工作流指南](./operations/GIT_WORKFLOW.md) 进行代码提交
2. 使用 [API规范快速参考](./api-specs/API_SPECS_QUICK_REF.md) 更新API文档
3. 查看 [开发进度](./development/PROGRESS.md) 了解当前任务状态

### 架构师/技术负责人
1. 查阅 [技术决策记录](./architecture/TECH_DECISIONS.md) 了解技术选型依据（特别是 TDR-007）
2. 深入理解 [Lambda 架构详解](./architecture/LAMBDA_ARCHITECTURE.md) 的流批分离设计
3. 参考 [Orchestrator架构](./architecture/ORCHESTRATOR_ARCHITECTURE.md) 了解网关设计
4. 阅读 [网关与BFF架构](./architecture/GATEWAY_BFF_ARCHITECTURE.md) 了解职责划分

---

## 📂 目录结构

```
docs/
├── README.md                    # 本文件 - 文档导航索引
├── architecture/                # 架构设计文档
│   ├── PROJECT_OVERVIEW.md      # 项目总览（Lambda 架构）
│   ├── LAMBDA_ARCHITECTURE.md   # Lambda 架构详解 ⭐ 新增
│   ├── GATEWAY_BFF_ARCHITECTURE.md
│   ├── ORCHESTRATOR_ARCHITECTURE.md
│   └── TECH_DECISIONS.md        # 技术决策（TDR-007 已更新）
├── development/                 # 开发计划文档
│   ├── DEVELOPMENT_PLAN.md
│   ├── PROGRESS.md
│   └── PHASE1_TEST_PLAN.md
├── operations/                  # 操作手册文档
│   ├── SCRIPTS_QUICK_REFERENCE.md
│   ├── SCRIPTS_REFACTORING.md
│   ├── SCRIPTS_COMPARISON.md
│   ├── GIT_WORKFLOW.md
│   └── NACOS_INTEGRATION.md
├── api-specs/                   # API文档
│   ├── API_SPECS_GUIDE.md
│   ├── API_SPECS_QUICK_REF.md
│   ├── query-service.openapi.json
│   ├── bff.openapi.json
│   ├── risk-ml-service.openapi.json
│   ├── orchestrator.openapi.json
│   └── graph-engine.openapi.json
├── changelog/                   # 变更记录
│   └── CHANGELOG_SCRIPTS.md
└── archive/                     # 归档文档
    └── SESSION_ARCHIVE_20241230.md
```

---

## 🎯 文档更新亮点（2026-01-03）

### ⭐ Lambda 架构重构
- **新增文档**: [Lambda 架构详解](./architecture/LAMBDA_ARCHITECTURE.md)
  - 详细说明 Speed Layer（Flink）、Batch Layer（Spark）、Serving Layer 的职责
  - 提供完整的代码示例和实现方案
  - 包含数据表设计、监控指标、应用场景对比

- **更新文档**: [项目总览](./architecture/PROJECT_OVERVIEW.md)
  - 架构图更新为 Lambda 架构
  - 新增数据流详解（实时流、批处理、图分析）
  - 明确 Flink、Spark、Graph Engine 的职责分工

- **更新文档**: [技术决策记录](./architecture/TECH_DECISIONS.md)
  - TDR-007 重大更新：从"流批一体"改为"Lambda 架构"
  - 详细说明为什么需要 Flink 双写 + Spark 覆盖
  - 对比传统架构与 Lambda 架构的优势

- **更新文档**: [README.md](../README.md)
  - 主页同步 Lambda 架构说明
  - 新增技术栈（Scala/Spark）
  - 更新项目结构和核心特性

### 🔧 架构优化要点
1. **Flink Stream Processor**: 从单写 PostgreSQL 改为**双写 PostgreSQL + Neo4j**
2. **Spark Batch Processor**: 新增**覆盖写入 Neo4j** 的逻辑
3. **Graph Engine**: 
   - ❌ 移除定时从 PostgreSQL 同步的逻辑
   - ✅ 新增监听 Kafka `transfers` Topic 的增量分析
   - ✅ 保留每日批量图分析

---

## 🔄 文档维护

### 文档更新原则
- **架构文档**: 重大架构变更时更新，需要团队review
- **开发计划**: 每个Phase开始和结束时更新
- **开发进度**: 实时更新，建议每日或每周更新
- **操作手册**: 脚本或流程变更时更新
- **API文档**: 每次API变更后自动生成更新
- **变更记录**: 重要变更时追加记录

### 归档策略
- 过时的会话记录移至 `archive/`
- 归档文档保留但不再维护
- 归档文件命名格式: `<TYPE>_ARCHIVE_<DATE>.md`

---

## 📞 联系方式

如有文档问题或建议，请联系项目维护者或提交Issue。

---

**最后更新**: 2026-01-03
