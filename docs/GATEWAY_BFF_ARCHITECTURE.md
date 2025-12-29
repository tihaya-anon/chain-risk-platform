# Gateway + BFF Architecture

## 架构概览

```
┌─────────┐
│ Frontend│
│  :5173  │
└────┬────┘
     │
     ▼
┌──────────────────┐
│   Gateway        │  ← JWT 认证、路由、添加用户上下文
│   (Java)         │
│   Port: 8080     │
└────┬─────────────┘
     │ X-User-Id
     │ X-User-Username
     │ X-User-Role
     ▼
┌──────────────────┐
│      BFF         │  ← 业务聚合、数据转换
│   (NestJS)       │
│   Port: 3001     │
└────┬─────────────┘
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Address │      │  Risk   │      │  Other  │
│ Service │      │ Service │      │ Services│
└─────────┘      └─────────┘      └─────────┘
```

## 职责划分

### Gateway (Java + Spring Cloud Gateway)
**端口**: 8080  
**职责**:
- ✅ JWT Token 验证
- ✅ 请求路由到 BFF
- ✅ 添加用户上下文请求头
  - `X-User-Id`: 用户ID
  - `X-User-Username`: 用户名
  - `X-User-Role`: 用户角色
- ✅ 限流、熔断
- ✅ 请求日志记录
- ✅ CORS 配置

**不负责**:
- ❌ 业务逻辑
- ❌ 数据聚合
- ❌ 数据转换

### BFF (NestJS)
**端口**: 3001  
**职责**:
- ✅ 业务逻辑聚合
- ✅ 调用后端微服务
- ✅ 数据格式转换
- ✅ 接收 Gateway 转发的用户上下文
- ✅ 为前端提供定制化 API

**不负责**:
- ❌ JWT 验证 (Gateway 已处理)
- ❌ 限流熔断 (Gateway 已处理)

## 请求流程

### 1. 登录流程 (无需认证)
```
Frontend → Gateway → BFF → Auth Service
         (直接转发)  (生成JWT)
```

### 2. 认证请求流程
```
Frontend 
  ↓ (携带 JWT Token)
Gateway
  ↓ (验证 JWT)
  ↓ (提取用户信息)
  ↓ (添加请求头: X-User-Id, X-User-Username, X-User-Role)
BFF
  ↓ (从请求头获取用户信息)
  ↓ (调用后端服务)
Backend Services
```

## 用户上下文传递

### Gateway 添加的请求头
```http
GET /api/v1/addresses/0x123... HTTP/1.1
Host: bff:3001
Authorization: Bearer eyJhbGc...  (保留原始 JWT)
X-User-Id: 1
X-User-Username: admin
X-User-Role: admin
```

### BFF 接收方式

#### 方式1: 使用 GatewayAuthGuard (推荐)
```typescript
@Get(':address')
@UseGuards(GatewayAuthGuard, JwtAuthGuard)
async getAddressInfo(@Request() req: any) {
  const user = req.user; // { sub, username, role, fromGateway }
  // ...
}
```

#### 方式2: 使用自定义装饰器
```typescript
@Get(':address')
async getAddressInfo(@GatewayUser() user: UserInfo) {
  // user: { sub, username, role }
  // ...
}
```

## 双模式支持

BFF 支持两种访问模式:

### 模式1: 通过 Gateway (生产环境)
```
Frontend → Gateway (8080) → BFF (3001)
           [JWT验证]         [用户上下文]
```

### 模式2: 直接访问 BFF (开发/测试)
```
Frontend → BFF (3001)
           [JWT验证]
```

**实现原理**:
- `GatewayAuthGuard` 优先检查 Gateway 请求头
- 如果没有 Gateway 请求头,`JwtAuthGuard` 验证 JWT
- 两种方式都能正确获取用户信息

## 配置

### Gateway 配置 (application.yml)
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: auth-route
          uri: http://bff:3001
          predicates:
            - Path=/api/v1/auth/**
          # 不需要认证
        
        - id: protected-route
          uri: http://bff:3001
          predicates:
            - Path=/api/v1/**
          filters:
            - AuthenticationFilter  # 添加用户上下文
```

### BFF 配置 (config.ts)
```typescript
export const config = {
  server: {
    port: 3001,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  // 后端服务地址
  services: {
    address: process.env.ADDRESS_SERVICE_URL,
    risk: process.env.RISK_SERVICE_URL,
  }
}
```

## 环境变量

### Gateway
```bash
JWT_SECRET=your-secret-key-change-this-in-production-min-256-bits
BFF_URL=http://bff:3001
```

### BFF
```bash
JWT_SECRET=your-secret-key-change-this-in-production-min-256-bits
ADDRESS_SERVICE_URL=http://address-service:8081
RISK_SERVICE_URL=http://risk-service:8082
```

**注意**: Gateway 和 BFF 的 JWT_SECRET 必须一致!

## 启动顺序

1. 基础设施 (Redis, Postgres, etc.)
2. 后端微服务 (Address Service, Risk Service, etc.)
3. **BFF** (端口 3001)
4. **Gateway** (端口 8080)
5. Frontend (端口 5173)

## 开发建议

### 本地开发
- 直接访问 BFF (http://localhost:3001)
- 跳过 Gateway,减少复杂度

### 集成测试
- 通过 Gateway 访问 (http://localhost:8080)
- 测试完整的认证流程

### 生产环境
- 只暴露 Gateway (端口 8080)
- BFF 不对外暴露

## 安全考虑

1. **JWT Secret**: 生产环境必须使用强密钥
2. **内网隔离**: BFF 只接受来自 Gateway 的请求
3. **请求头验证**: BFF 可选择性验证请求来源
4. **HTTPS**: 生产环境使用 HTTPS

## 监控

- Gateway: `/actuator/health`, `/actuator/metrics`
- BFF: `/api/v1/health` (需添加)

## 扩展性

- Gateway 和 BFF 都是无状态的,可水平扩展
- 使用 Redis 做分布式限流
- 使用 Nacos 做服务发现
