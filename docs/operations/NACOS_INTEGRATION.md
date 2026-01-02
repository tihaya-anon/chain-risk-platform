# Nacos Integration Guide

> 配置中心 + 服务注册与发现

## 概述

Chain Risk Platform 使用 Nacos 作为：
1. **配置中心 (Config Center)** - 动态配置管理，支持运行时修改
2. **服务注册与发现 (Service Discovery)** - 服务自动注册、健康检查、负载均衡

## 架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Nacos Server (:18848)                           │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐       │
│  │      配置中心 (Config)      │  │   服务注册 (Naming)         │       │
│  │                             │  │                             │       │
│  │ • chain-risk-pipeline.yaml  │  │ • orchestrator (8080)       │       │
│  │   (共享 Pipeline 配置)      │  │ • bff (3001)                │       │
│  │                             │  │ • query-service (8081)      │       │
│  │                             │  │ • risk-ml-service (8082)    │       │
│  │                             │  │ • graph-engine (8084)       │       │
│  │                             │  │ • data-ingestion (9091)     │       │
│  └─────────────────────────────┘  └─────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                │                               │
        配置监听 & 动态刷新              服务发现 & 负载均衡
                │                               │
    ┌───────────┼───────────────────────────────┼───────────────┐
    │           │                               │               │
    ▼           ▼                               ▼               ▼
┌────────┐ ┌────────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐
│Orchestr│ │Graph Engine│ │Query Svc│ │Risk ML   │ │  BFF    │
│  Java  │ │   Java     │ │   Go    │ │ Python   │ │ Node.js │
└────────┘ └────────────┘ └─────────┘ └──────────┘ └─────────┘
```

## 快速开始

### 1. 配置 Nacos 鉴权

从 Nacos 3.0 开始，默认开启鉴权。需要配置用户名密码：

```bash
# 设置环境变量
export NACOS_USERNAME=nacos
export NACOS_PASSWORD=nacos  # 请修改为你的实际密码
```

**首次登录设置密码：**

如果是新安装的 Nacos，需要先初始化管理员密码：

```bash
# 通过 API 设置密码
curl -X POST 'http://<NACOS_HOST>:18848/nacos/v1/auth/users/admin' \
    -d 'password=your_secure_password'
```

或者访问 Nacos 控制台 `http://<NACOS_HOST>:18848/nacos`，首次访问会提示设置密码。

### 2. 初始化 Nacos 配置

```bash
# 本地 Nacos (使用默认用户名密码)
./infra/nacos/init-nacos-config.sh localhost

# 远程 Nacos (指定用户名密码)
./infra/nacos/init-nacos-config.sh 192.168.1.100:18848 nacos your_password

# 或使用环境变量
export NACOS_SERVER=192.168.1.100:18848
export NACOS_USERNAME=nacos
export NACOS_PASSWORD=your_password
./infra/nacos/init-nacos-config.sh
```

### 3. 启动服务

```bash
# 设置远程环境变量
source scripts/env-remote.sh 192.168.1.100

# 设置 Nacos 鉴权信息
export NACOS_USERNAME=nacos
export NACOS_PASSWORD=your_password

# 启动 Java 服务
cd services/orchestrator && mvn spring-boot:run
cd processing/graph-engine && mvn spring-boot:run

# 启动 Go 服务
cd data-ingestion && go run ./cmd/ingestion
cd services/query-service && go run ./cmd/main.go
```

### 4. 查看 Nacos 控制台

访问 `http://<NACOS_HOST>:18848/nacos`

- 用户名: `nacos` (或你设置的用户名)
- 密码: 你设置的密码

## 鉴权配置

### 环境变量

| 变量              | 说明             | 默认值            |
| ----------------- | ---------------- | ----------------- |
| `NACOS_SERVER`    | Nacos 服务器地址 | `localhost:18848` |
| `NACOS_NAMESPACE` | 命名空间         | `public`          |
| `NACOS_USERNAME`  | 用户名           | `nacos`           |
| `NACOS_PASSWORD`  | 密码             | `nacos`           |

### Java 服务配置 (bootstrap.yml)

```yaml
spring:
  cloud:
    nacos:
      server-addr: ${NACOS_SERVER:localhost:18848}
      username: ${NACOS_USERNAME:nacos}
      password: ${NACOS_PASSWORD:nacos}
```

### Go 服务配置

```go
cc := constant.ClientConfig{
    NamespaceId: "public",
    Username:    os.Getenv("NACOS_USERNAME"),
    Password:    os.Getenv("NACOS_PASSWORD"),
}
```

### 关闭鉴权（仅限开发环境）

如果是本地开发环境，可以在 Nacos 服务端关闭鉴权：

修改 `application.properties`:
```properties
# 关闭控制台鉴权
nacos.core.auth.console.enabled=false
# 关闭客户端鉴权
nacos.core.auth.enabled=false
```

## 配置管理

### 共享配置文件

**DataId**: `chain-risk-pipeline.yaml`  
**Group**: `DEFAULT_GROUP`

```yaml
pipeline:
  enabled: true                    # 全局开关
  
  ingestion:
    enabled: true                  # 数据采集开关
    polling:
      intervalMs: 12000            # 轮询间隔
      batchSize: 10                # 批次大小
      
  graph-sync:
    enabled: true                  # 图同步开关
    intervalMs: 300000             # 同步间隔 (5分钟)
    batchSize: 1000                # 批次大小
```

### 动态配置刷新

配置修改后会自动推送到所有服务：

1. **Java 服务**: 使用 `@RefreshScope` 注解
2. **Go 服务**: 使用 `ListenConfig` 回调
3. **Python 服务**: 使用 `add_config_watcher`
4. **Node.js 服务**: 使用 `subscribe` 方法

## 服务注册

### 服务列表

| 服务名          | 端口 | 语言    | 状态 |
| --------------- | ---- | ------- | ---- |
| orchestrator    | 8080 | Java    | ✅    |
| graph-engine    | 8084 | Java    | ✅    |
| data-ingestion  | 9091 | Go      | ✅    |
| query-service   | 8081 | Go      | 🔶    |
| risk-ml-service | 8082 | Python  | 🔶    |
| bff             | 3001 | Node.js | 🔶    |

### 服务发现使用

```java
// Java - 使用 DiscoveryClient
@Autowired
private DiscoveryClient discoveryClient;

List<ServiceInstance> instances = discoveryClient.getInstances("query-service");
```

```go
// Go - 使用 Nacos SDK
instances, err := nacosClient.GetService("query-service")
```

## Admin API

每个服务都提供 Admin API 用于运维控制：

### 状态查询

```bash
# Orchestrator
curl http://localhost:8080/api/admin/pipeline/status

# Graph Engine
curl http://localhost:8084/admin/status

# Data Ingestion
curl http://localhost:9091/admin/status
```

### 手动控制

```bash
# 暂停 Graph Sync
curl -X POST http://localhost:8084/admin/sync/pause

# 恢复 Graph Sync
curl -X POST http://localhost:8084/admin/sync/resume

# 立即触发同步
curl -X POST http://localhost:8084/admin/sync/trigger
```

## 控制优先级

```
┌────────────────────────────────────────────────────────────────┐
│                      控制优先级                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   1. Admin API 手动暂停 (最高优先级)                           │
│      ↓ 如果没有手动暂停                                        │
│   2. Nacos 配置 enabled=false                                  │
│      ↓ 如果配置启用                                            │
│   3. 正常运行，使用 Nacos 配置的参数                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 故障排除

### 1. 无法连接 Nacos / 鉴权失败

```bash
# 检查 Nacos 健康状态
curl http://<NACOS_HOST>:18848/nacos/v1/console/health/readiness

# 测试登录
curl -X POST 'http://<NACOS_HOST>:18848/nacos/v1/auth/login' \
    -d 'username=nacos&password=your_password'
```

如果返回 `{"accessToken":"..."}` 则鉴权成功。

### 2. 配置不生效

1. 检查 DataId 和 Group 是否正确
2. 检查 YAML 格式是否正确
3. 查看服务日志确认配置已加载

### 3. 服务未注册

1. 检查服务是否正常启动
2. 检查网络连接
3. 检查用户名密码是否正确
4. 查看 Nacos 控制台服务列表

## 参考文档

- [Nacos 官方文档](https://nacos.io/zh-cn/docs/what-is-nacos.html)
- [Nacos 鉴权配置](https://nacos.io/docs/next/manual/admin/auth/)
- [Spring Cloud Alibaba](https://spring-cloud-alibaba-group.github.io/github-pages/hoxton/en-us/index.html)
- [Nacos Go SDK](https://github.com/nacos-group/nacos-sdk-go)
