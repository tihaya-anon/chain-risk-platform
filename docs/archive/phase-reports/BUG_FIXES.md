# Bug Fixes - Integration Test Issues

> 修复集成测试中的 Kafka 连接和 Flink 停止问题

**Date**: 2026-01-03  
**Branch**: `feature/lambda-architecture-implementation`  
**Commit**: af811cc

---

## 🐛 问题 1: Kafka Producer 连接失败

### 症状
```
[WARN] Connection to node -1 (localhost/127.0.0.1:19092) could not be established
[WARN] Bootstrap broker localhost:19092 (id: -1 rack: null) disconnected
```

### 根本原因
1. Kafka Producer 尝试连接 `localhost:19092`
2. 实际的 Kafka 在远程服务器 `100.120.144.128:19092`
3. `kafka.transfers.brokers` 参数没有正确传递给 Flink job
4. 默认值是 `localhost:19092` 而不是使用 `$KAFKA_BROKERS` 环境变量

### 修复方案

#### 1. 更新 `run-flink.sh`
```bash
# Before (missing)
JAVA_ARGS+=(--kafka.brokers "${KAFKA_BROKERS}")

# After (fixed)
JAVA_ARGS+=(--kafka.brokers "${KAFKA_BROKERS}")
JAVA_ARGS+=(--kafka.transfers.brokers "${KAFKA_BROKERS}")  # 新增
JAVA_ARGS+=(--kafka.transfers.topic "transfers")           # 新增
```

#### 2. 更新 `run-integration-test.sh`
```bash
# Export all Kafka configuration
export KAFKA_BROKERS="$KAFKA_BROKER"  # 使用远程地址
export KAFKA_TRANSFERS_TOPIC="transfers"
```

### 验证
```bash
# 检查 Flink 日志，应该看到正确的 Kafka 地址
grep "Kafka producer - brokers" logs/stream-processor.log
# 输出: Kafka producer - brokers: 100.120.144.128:19092, topic: transfers
```

---

## 🐛 问题 2: Flink 无法停止

### 症状
- 按 Ctrl+C 无法停止 Flink
- 必须去任务管理器手动结束进程
- 集成测试结束后 Flink 进程仍在运行

### 根本原因
1. Flink 作为后台进程运行，Ctrl+C 无法传递信号
2. `pkill` 命令有时无法正确识别 Flink 进程
3. 没有统一的进程管理机制

### 修复方案

#### 1. 添加 tmux 支持 (`run-flink.sh`)
```bash
# Check if tmux is available
if command -v tmux &> /dev/null; then
    log_info "Using tmux session: flink-stream"
    
    # Kill existing session if exists
    tmux kill-session -t "flink-stream" 2>/dev/null || true
    
    # Create new tmux session and run Flink
    tmux new-session -d -s "flink-stream" "java ${JAVA_ARGS[*]}"
    
    log_info "Flink started in tmux session 'flink-stream'"
    log_info "To stop: tmux kill-session -t flink-stream"
else
    log_warn "tmux not installed, running Flink in foreground"
    java "${JAVA_ARGS[@]}"
fi
```

#### 2. 更新 Makefile (`flink-stop`)
```makefile
flink-stop: ## Stop stream-processor (tmux or pkill)
	@echo "🛑 Stopping stream-processor..."
	@if command -v tmux >/dev/null 2>&1 && tmux has-session -t flink-stream 2>/dev/null; then \
		tmux kill-session -t flink-stream; \
		echo "✅ Stopped tmux session 'flink-stream'"; \
	else \
		pkill -f "stream-processor.*\.jar" 2>/dev/null || true; \
		sleep 1; \
		pkill -9 -f "stream-processor.*\.jar" 2>/dev/null || true; \
		echo "✅ stream-processor stopped"; \
	fi
```

#### 3. 添加日志查看命令 (`flink-logs`)
```makefile
flink-logs: ## View stream-processor logs (tmux or file)
	@if command -v tmux >/dev/null 2>&1 && tmux has-session -t flink-stream 2>/dev/null; then \
		tmux attach -t flink-stream; \
	else \
		tail -f $(DIR_FLINK)/logs/stream-processor.log 2>/dev/null || echo "❌ No logs found"; \
	fi
```

#### 4. 更新集成测试清理逻辑
```bash
cleanup() {
    # Kill Flink if running (tmux or direct)
    if command -v tmux &> /dev/null && tmux has-session -t flink-stream 2>/dev/null; then
        tmux kill-session -t flink-stream 2>/dev/null || true
    fi
    if [ -n "$FLINK_PID" ]; then
        kill $FLINK_PID 2>/dev/null || true
    fi
}
```

### 使用方法

#### 启动 Flink
```bash
./scripts/run-flink.sh
# 或
make flink-run

# 输出:
# [INFO] Using tmux session: flink-stream
# [INFO] Flink started in tmux session 'flink-stream'
# [INFO] To stop: tmux kill-session -t flink-stream
```

#### 查看日志
```bash
make flink-logs
# 或
tmux attach -t flink-stream

# 退出 tmux: Ctrl+B 然后按 D (detach)
```

#### 停止 Flink
```bash
make flink-stop
# 或
tmux kill-session -t flink-stream
```

### 安装 tmux
```bash
# macOS
brew install tmux

# Linux
sudo apt-get install tmux

# 验证安装
tmux -V
```

---

## ✅ 验证

### 1. 测试 Kafka 连接
```bash
# 启动 Flink
make flink-run

# 检查日志
make flink-logs

# 应该看到:
# [INFO] Kafka producer - brokers: 100.120.144.128:19092, topic: transfers
# 而不是: localhost:19092
```

### 2. 测试 Flink 停止
```bash
# 启动 Flink
make flink-run

# 停止 Flink
make flink-stop

# 验证进程已停止
ps aux | grep stream-processor
# 应该没有输出（除了 grep 本身）
```

### 3. 运行集成测试
```bash
make test-integration

# 测试应该:
# 1. 正确连接到远程 Kafka
# 2. 正常写入 PostgreSQL + Neo4j
# 3. 测试结束后自动清理 Flink 进程
```

---

## 📊 对比

### Kafka 连接

| 方面 | 修复前 | 修复后 |
|-----|--------|--------|
| **Kafka Source** | ✅ 正确 (100.120.144.128:19092) | ✅ 正确 |
| **Kafka Producer** | ❌ 错误 (localhost:19092) | ✅ 正确 (100.120.144.128:19092) |
| **配置传递** | ❌ 缺失 | ✅ 完整 |

### Flink 进程管理

| 方面 | 修复前 | 修复后 |
|-----|--------|--------|
| **停止方式** | ❌ 任务管理器 | ✅ make flink-stop |
| **日志查看** | ❌ tail -f 文件 | ✅ make flink-logs (tmux) |
| **进程隔离** | ❌ 后台进程 | ✅ tmux session |
| **清理** | ❌ 手动 | ✅ 自动 (cleanup) |

---

## 🎯 影响范围

### 修改的文件
1. `scripts/run-flink.sh` - 添加 tmux 支持，修复 Kafka 配置
2. `scripts/run-integration-test.sh` - 修复 Kafka 配置，添加 tmux 清理
3. `Makefile` - 更新 flink-stop 和 flink-logs 命令

### 不影响
- Flink job 代码（TransferExtractionJob.java）
- Neo4j Sink 实现
- PostgreSQL Sink 实现

---

## 📚 相关文档

- [Phase 1 Summary](./PHASE1_SUMMARY.md)
- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
- [Integration Test README](../../tests/integration/README.md)

---

## 🙏 致谢

感谢用户报告这些问题，帮助我们改进系统的可用性和稳定性！

---

**Last Updated**: 2026-01-03  
**Author**: @user
