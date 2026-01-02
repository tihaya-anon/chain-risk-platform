# Scripts Directory

本目录包含 Chain Risk Platform 项目的各种脚本工具。

## 📁 目录结构

```
scripts/
├── common.sh              # 通用工具函数库（推荐使用）
├── load-env.sh            # 环境变量加载（向后兼容，推荐使用 common.sh）
├── check-infra.sh         # 基础设施健康检查
├── run-graph-engine.sh    # Graph Engine 启动脚本
├── run-flink.sh           # Flink Stream Processor 启动脚本
├── run-integration-test.sh # 集成测试脚本
├── test-e2e.sh            # 端到端测试脚本
├── update-api-specs.sh    # API 规范更新脚本
└── archive/               # 归档的一次性使用脚本
    ├── init-project.sh    # 项目初始化（仅首次使用）
    ├── setup-hosts.sh     # 主机映射设置（可选）
    └── sparse-clone.sh    # 稀疏克隆（部署用）
```

## 🔧 核心脚本

### common.sh - 通用工具函数库

提供可复用的工具函数，包括：

- **日志函数**: `log_info`, `log_success`, `log_warn`, `log_error`, `log_section`
- **环境加载**: `load_env` - 从 .env.local 加载环境变量
- **Java 设置**: `setup_java17` - 配置 Java 17 环境
- **工具函数**: `command_exists`, `check_port`, `wait_for_service`
- **进程管理**: `kill_by_pattern` - 按模式停止进程
- **构建函数**: `build_go_service`, `build_java_service`

**使用方式**:
```bash
#!/bin/bash
source scripts/common.sh

load_env || exit 1
log_info "Starting service..."
```

### check-infra.sh - 基础设施健康检查

检查所有 Docker 基础设施服务的健康状态。

**使用方式**:
```bash
# 本地检查
./scripts/check-infra.sh

# 远程检查
./scripts/check-infra.sh 192.168.1.100
DOCKER_HOST_IP=192.168.1.100 ./scripts/check-infra.sh
```

**检查的服务**:
- PostgreSQL (15432)
- Redis (16379)
- Kafka (19092)
- Neo4j (17474)
- Nacos (18848)
- Prometheus (19090)
- Grafana (13001)
- Jaeger (26686)
- Kafka Exporter (19308)
- Postgres Exporter (19187)

### run-graph-engine.sh - Graph Engine 启动

启动 Graph Engine 服务（Java Spring Boot）。

**使用方式**:
```bash
# 运行（如果需要会自动构建）
./scripts/run-graph-engine.sh

# 强制重新构建
./scripts/run-graph-engine.sh --build
```

**或使用 Makefile**:
```bash
make graph-run
```

### run-flink.sh - Flink Stream Processor 启动

启动 Flink 流处理器。

**使用方式**:
```bash
./scripts/run-flink.sh
```

**或使用 Makefile**:
```bash
make flink-run
```

### run-integration-test.sh - 集成测试

运行完整的数据管道集成测试，包括：
1. 启动 Mock Etherscan Server
2. 运行数据采集
3. 运行流处理
4. 验证数据库结果

**使用方式**:
```bash
./scripts/run-integration-test.sh
```

**或使用 Makefile**:
```bash
make test-integration
```

### test-e2e.sh - 端到端测试

测试基础设施和数据流的端到端功能。

**使用方式**:
```bash
# 本地 Docker
./scripts/test-e2e.sh

# 远程 Docker (通过 SSH)
./scripts/test-e2e.sh --remote user@host

# 远程 Docker (通过 IP)
DOCKER_HOST_IP=192.168.1.100 ./scripts/test-e2e.sh --remote-ip

# 跳过流处理器检查（仅测试基础设施）
./scripts/test-e2e.sh --skip-processor
```

### update-api-specs.sh - API 规范更新

从运行中的服务获取 OpenAPI 规范并保存到 `docs/api-specs/`。

**使用方式**:
```bash
# 更新所有服务
./scripts/update-api-specs.sh --all

# 更新特定服务
./scripts/update-api-specs.sh --query
./scripts/update-api-specs.sh --bff --risk
```

**或使用 Makefile**:
```bash
make api-update           # 更新所有
make api-update-query     # 更新 Query Service
make api-update-bff       # 更新 BFF
```

## 📦 归档脚本

这些脚本已移至 `archive/` 目录，因为它们是一次性使用或很少使用的。

### init-project.sh
初始化项目目录结构。仅在项目首次创建时使用。

### setup-hosts.sh
配置 /etc/hosts 映射。用于开发环境的主机名解析。

### sparse-clone.sh
稀疏克隆仓库。用于 Docker 部署时只克隆必要文件。

## 🚀 推荐工作流

### 1. 首次设置
```bash
# 1. 创建环境配置
cp .env.example .env.local
# 编辑 .env.local 设置 DOCKER_HOST_IP

# 2. 启动基础设施
make infra-up

# 3. 检查基础设施
make infra-check

# 4. 初始化所有服务
make init-all
```

### 2. 日常开发
```bash
# 启动所有后端服务（后台运行）
make run-svc

# 查看日志
make logs-all
make logs-query
make logs-risk

# 停止所有服务
make stop-svc
```

### 3. 测试
```bash
# 运行集成测试
make test-integration

# 运行端到端测试
./scripts/test-e2e.sh
```

### 4. 单独运行服务
```bash
# 使用 Makefile（推荐）
make query-run
make risk-run
make graph-run
make flink-run

# 或使用脚本
./scripts/run-graph-engine.sh
./scripts/run-flink.sh
```

## 📝 编写新脚本的最佳实践

1. **使用 common.sh**
   ```bash
   #!/bin/bash
   source "$(dirname "$0")/common.sh"
   load_env || exit 1
   ```

2. **添加帮助信息**
   ```bash
   # 在脚本开头添加使用说明
   # Usage: ./script.sh [options]
   ```

3. **错误处理**
   ```bash
   set -e  # 遇到错误立即退出
   ```

4. **日志输出**
   ```bash
   log_info "Starting process..."
   log_success "Process completed"
   log_warn "Warning message"
   log_error "Error occurred"
   ```

5. **清理资源**
   ```bash
   cleanup() {
       log_info "Cleaning up..."
       # 清理代码
   }
   trap cleanup EXIT
   ```

## 🔗 相关文档

- [Makefile 使用指南](../README.md#makefile-commands)
- [开发环境设置](../docs/guides/development-setup.md)
- [部署指南](../docs/guides/deployment.md)

## ❓ 常见问题

### Q: 为什么要使用 common.sh？
A: common.sh 提供了统一的工具函数，避免在每个脚本中重复代码，提高可维护性。

### Q: load-env.sh 和 common.sh 的 load_env 有什么区别？
A: load-env.sh 是旧版本，为了向后兼容保留。新脚本应该使用 common.sh 的 load_env 函数。

### Q: 如何停止后台运行的服务？
A: 使用 `make stop-svc` 停止所有服务，或使用 `make stop-query`、`make stop-risk` 等停止单个服务。

### Q: 为什么有些脚本在 archive 目录？
A: 这些是一次性使用或很少使用的脚本，移到 archive 目录可以保持主目录整洁。
