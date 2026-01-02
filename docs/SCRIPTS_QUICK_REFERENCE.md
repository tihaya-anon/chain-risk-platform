# 🚀 Scripts 快速参考

## 常用命令速查

### 基础设施管理
```bash
make infra-up          # 启动基础设施
make infra-down        # 停止基础设施
make infra-check       # 检查基础设施状态
```

### 服务启动（推荐：后台运行）
```bash
make run-svc           # 启动所有服务（后台）
make logs-all          # 查看所有日志
make logs-query        # 查看 query 服务日志
make logs-risk         # 查看 risk 服务日志
make stop-svc          # 停止所有服务
```

### 单独服务管理
```bash
# 启动
make query-run         # Query Service
make risk-run          # Risk ML Service
make bff-run           # BFF Service
make graph-run         # Graph Engine
make flink-run         # Flink Processor

# 停止
make stop-query        # 停止 Query Service
make stop-risk         # 停止 Risk ML Service
make stop-bff          # 停止 BFF Service
make graph-stop        # 停止 Graph Engine
make flink-stop        # 停止 Flink Processor
```

### 测试
```bash
make test-integration  # 集成测试
make test-all          # 所有单元测试
./scripts/test-e2e.sh  # 端到端测试
```

### 构建和清理
```bash
make init-all          # 初始化所有服务
make build-all         # 构建所有服务
make clean-all         # 清理所有构建产物
```

### API 文档
```bash
make api-update        # 更新所有 API 规范
make api-update-query  # 更新 Query Service API
make api-update-bff    # 更新 BFF API
```

## 脚本直接调用

### 基础设施检查
```bash
./scripts/check-infra.sh              # 本地检查
./scripts/check-infra.sh 192.168.1.100  # 远程检查
```

### 服务启动
```bash
./scripts/run-graph-engine.sh         # 启动 Graph Engine
./scripts/run-graph-engine.sh --build # 强制重新构建
./scripts/run-flink.sh                # 启动 Flink
```

### 测试
```bash
./scripts/run-integration-test.sh     # 集成测试
./scripts/test-e2e.sh                 # 端到端测试
./scripts/test-e2e.sh --remote-ip     # 远程 Docker 测试
```

### API 规范更新
```bash
./scripts/update-api-specs.sh --all   # 更新所有
./scripts/update-api-specs.sh --query # 更新 Query Service
```

## 编写新脚本模板

```bash
#!/bin/bash
# ============================================================
# Script Description
# ============================================================
# Usage: ./script.sh [options]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common utilities
source "$SCRIPT_DIR/common.sh"

# Load environment
load_env "$PROJECT_ROOT" || exit 1

# Main logic
log_info "Starting process..."

# Your code here

log_success "Process completed"
```

## 常用工具函数

```bash
# 加载 common.sh
source scripts/common.sh

# 日志
log_info "Information message"
log_success "Success message"
log_warn "Warning message"
log_error "Error message"
log_section "Section Title"

# 环境
load_env                              # 加载 .env.local
setup_java17                          # 设置 Java 17

# 工具
command_exists mvn                    # 检查命令是否存在
check_port localhost 8080             # 检查端口
wait_for_service "API" "http://..."   # 等待服务就绪
kill_by_pattern "my-service"          # 停止进程

# 构建
build_go_service "path" "binary"      # 构建 Go 服务
build_java_service "path"             # 构建 Java 服务
```

## 故障排查

### 服务无法启动
```bash
# 1. 检查基础设施
make infra-check

# 2. 检查环境配置
cat .env.local

# 3. 查看服务日志
make logs-query
make logs-risk
make logs-bff
```

### 端口被占用
```bash
# 查看端口占用
lsof -i :8081  # Query Service
lsof -i :8082  # Risk Service
lsof -i :3001  # BFF Service

# 停止服务
make stop-svc
```

### 清理并重启
```bash
# 1. 停止所有服务
make stop-svc
make infra-down

# 2. 清理构建产物
make clean-all

# 3. 重新启动
make infra-up
make infra-check
make run-svc
```

## 环境变量

必需的环境变量（在 .env.local 中设置）：

```bash
DOCKER_HOST_IP=192.168.1.100    # Docker 主机 IP
ETHERSCAN_API_KEY=your-key      # Etherscan API Key（可选）
```

自动设置的环境变量：

```bash
POSTGRES_HOST=$DOCKER_HOST_IP
POSTGRES_PORT=15432
REDIS_HOST=$DOCKER_HOST_IP
REDIS_PORT=16379
KAFKA_BROKERS=$DOCKER_HOST_IP:19092
NEO4J_URI=bolt://$DOCKER_HOST_IP:17687
```

## 文档链接

- 📖 [完整脚本指南](scripts/README.md)
- 📊 [整理对比](docs/SCRIPTS_COMPARISON.md)
- 📝 [整理总结](docs/SCRIPTS_REFACTORING.md)
- 📋 [更新日志](docs/CHANGELOG_SCRIPTS.md)
- 📦 [归档脚本](scripts/archive/README.md)

## 快速开始

```bash
# 1. 配置环境
cp .env.example .env.local
# 编辑 .env.local

# 2. 启动基础设施
make infra-up && make infra-check

# 3. 初始化服务
make init-all

# 4. 启动服务
make run-svc

# 5. 查看日志
make logs-all

# 6. 运行测试
make test-integration

# 7. 停止服务
make stop-svc
```

---

💡 **提示**: 使用 `make help` 查看所有可用命令
