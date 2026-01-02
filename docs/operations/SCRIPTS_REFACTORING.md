# Scripts 和 Makefile 整理总结

## 📊 整理概览

本次整理优化了项目的脚本和 Makefile 结构，提高了代码复用性和可维护性。

## ✅ 完成的优化

### 1. 创建通用工具库 (`scripts/common.sh`)

**新增功能**:
- ✨ 统一的日志函数（info, success, warn, error, section）
- ✨ 环境变量加载函数 `load_env`
- ✨ Java 17 环境设置函数 `setup_java17`
- ✨ 通用工具函数（command_exists, check_port, wait_for_service）
- ✨ 进程管理函数 `kill_by_pattern`
- ✨ 构建辅助函数（build_go_service, build_java_service）

**优势**:
- 避免在每个脚本中重复定义相同的函数
- 统一的日志格式和颜色输出
- 更容易维护和更新

### 2. 简化现有脚本

**优化的脚本**:
- ✅ `run-graph-engine.sh` - 使用 common.sh 函数，减少 ~40 行代码
- ✅ `run-flink.sh` - 使用 common.sh，添加日志输出
- ✅ `check-infra.sh` - 使用 common.sh 的颜色定义
- ✅ `load-env.sh` - 简化并标记为向后兼容

**改进**:
- 代码更简洁，可读性更好
- 统一的错误处理和日志输出
- 更容易调试和维护

### 3. 优化 Makefile

**新增通用变量**:
```makefile
# Java 17 环境
JAVA17_HOME := $(shell /usr/libexec/java_home -v 17 2>/dev/null)
JAVA17_ENV := export JAVA_HOME=$(JAVA17_HOME) &&

# Maven 通用标志
MVN_QUIET := -q
MVN_SKIP_TESTS := -DskipTests

# 环境加载命令
LOAD_ENV := set -a && source .env.local && source ./scripts/load-env.sh > /dev/null &&

# 服务目录
DIR_INGESTION := data-ingestion
DIR_QUERY := services/query-service
# ... 等等
```

**新增命令**:
- ✨ `make stop-query` - 停止 query 服务
- ✨ `make stop-risk` - 停止 risk 服务
- ✨ `make stop-bff` - 停止 bff 服务
- ✨ `make stop-alert` - 停止 alert 服务
- ✨ `make stop-ingestion` - 停止数据采集
- ✨ `make flink-stop` - 停止 flink 处理器
- ✨ `make graph-stop` - 停止 graph engine（合并了 stop-graph-engine.sh）

**改进**:
- 减少了 Java 服务中重复的 JAVA_HOME 设置代码
- 统一的 Maven 构建参数
- 更细粒度的服务控制命令

### 4. 归档不常用脚本

**移至 `scripts/archive/`**:
- 📦 `init-project.sh` - 项目初始化（仅首次使用）
- 📦 `setup-hosts.sh` - 主机映射设置（可选）
- 📦 `sparse-clone.sh` - 稀疏克隆（部署用）

**删除的脚本**:
- 🗑️ `stop-graph-engine.sh` - 功能已合并到 Makefile 的 `graph-stop`

**优势**:
- 主 scripts 目录更整洁
- 保留了历史脚本以备不时之需
- 清晰的文档说明每个归档脚本的用途

### 5. 完善文档

**新增文档**:
- 📝 `scripts/README.md` - 完整的脚本使用指南
- 📝 `scripts/archive/README.md` - 归档脚本说明

**内容包括**:
- 每个脚本的详细说明和使用方式
- 推荐的工作流程
- 编写新脚本的最佳实践
- 常见问题解答

## 📈 改进效果

### 代码复用
- **前**: 日志函数在 5+ 个脚本中重复定义
- **后**: 统一使用 common.sh，一处定义，多处使用

### 代码量减少
- `run-graph-engine.sh`: 从 ~90 行减少到 ~50 行
- `run-flink.sh`: 从 ~10 行增加到 ~20 行（添加了日志）
- `check-infra.sh`: 从 ~100 行减少到 ~90 行
- **总体**: 减少约 15% 的重复代码

### Makefile 可维护性
- **前**: Java 服务的 JAVA_HOME 设置重复 6 次
- **后**: 使用 `$(JAVA17_ENV)` 变量，一处定义
- **前**: 缺少单独停止服务的命令
- **后**: 为每个服务添加了 stop 命令

### 目录结构
```
scripts/
├── common.sh              ⭐ 新增：通用工具库
├── README.md              ⭐ 新增：完整文档
├── load-env.sh            ✏️ 简化
├── check-infra.sh         ✏️ 优化
├── run-graph-engine.sh    ✏️ 简化
├── run-flink.sh           ✏️ 优化
├── run-integration-test.sh
├── test-e2e.sh
├── update-api-specs.sh
└── archive/               ⭐ 新增：归档目录
    ├── README.md          ⭐ 新增：归档说明
    ├── init-project.sh    📦 归档
    ├── setup-hosts.sh     📦 归档
    └── sparse-clone.sh    📦 归档
```

## 🎯 使用建议

### 开发新脚本时
```bash
#!/bin/bash
source "$(dirname "$0")/common.sh"

# 加载环境
load_env || exit 1

# 使用日志函数
log_info "Starting process..."
log_success "Process completed"

# 使用工具函数
if ! command_exists mvn; then
    log_error "Maven not found"
    exit 1
fi
```

### 日常开发工作流
```bash
# 1. 启动基础设施
make infra-up
make infra-check

# 2. 启动所有服务（后台）
make run-svc

# 3. 查看日志
make logs-all

# 4. 停止特定服务
make stop-query

# 5. 停止所有服务
make stop-svc
```

### 测试工作流
```bash
# 集成测试
make test-integration

# 端到端测试
./scripts/test-e2e.sh

# 更新 API 规范
make api-update
```

## 🔄 后续优化建议

1. **考虑将更多脚本迁移到使用 common.sh**
   - `run-integration-test.sh` 可以使用 common.sh 的日志函数
   - `test-e2e.sh` 可以使用 common.sh 的工具函数
   - `update-api-specs.sh` 可以使用 common.sh 的日志函数

2. **考虑添加更多通用函数到 common.sh**
   - PostgreSQL 连接检查函数
   - Kafka 主题操作函数
   - Docker 容器状态检查函数

3. **考虑创建服务管理脚本**
   - `scripts/service-manager.sh` - 统一的服务启动/停止/状态查看工具
   - 可以替代多个 run-*.sh 脚本

4. **考虑添加配置验证脚本**
   - 检查 .env.local 是否配置正确
   - 验证所有必需的工具是否已安装
   - 检查端口是否被占用

## 📚 相关文档

- [scripts/README.md](scripts/README.md) - 脚本使用指南
- [scripts/archive/README.md](scripts/archive/README.md) - 归档脚本说明
- [Makefile](../Makefile) - 构建和运行命令

## ✨ 总结

本次整理显著提高了项目脚本的可维护性和可读性：

- ✅ 创建了统一的工具函数库
- ✅ 减少了代码重复
- ✅ 优化了 Makefile 结构
- ✅ 整理了目录结构
- ✅ 完善了文档

现在开发者可以更容易地：
- 编写新的脚本（使用 common.sh）
- 理解现有脚本的功能（查看 README）
- 管理服务的生命周期（使用 Makefile 命令）
- 调试问题（统一的日志格式）
