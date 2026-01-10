# Orchestrator Architecture

## Overview

Orchestrator is a unified service that combines API Gateway and API Orchestration capabilities.

```
┌─────────┐
│ Frontend│
│  :5173  │
└────┬────┘
     │
     ▼
┌──────────────────────────────────┐
│       Orchestrator               │
│       (Java + Spring Cloud)      │
│       Port: 8080                 │
│                                  │
│  ┌────────────────────────────┐ │
│  │  Gateway Functions         │ │
│  │  - JWT Authentication      │ │
│  │  - Request Routing         │ │
│  │  - User Context Injection  │ │
│  │  - CORS                    │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │  Orchestration Functions   │ │
│  │  - Multi-API Coordination  │ │
│  │  - Parallel Execution      │ │
│  │  - Result Aggregation      │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │  Resilience Functions      │ │
│  │  - Circuit Breaker         │ │
│  │  - Rate Limiting           │ │
│  │  - Fallback/Degradation    │ │
│  │  - Retry                   │ │
│  └────────────────────────────┘ │
└────┬─────────────────────────────┘
     │ X-User-Id
     │ X-User-Username
     │ X-User-Role
     ▼
┌──────────────────┐
│      BFF         │
│   (NestJS)       │
│   Port: 3001     │
└────┬─────────────┘
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Query   │      │  Risk   │      │  Other  │
│ Service │      │ Service │      │ Services│
└─────────┘      └─────────┘      └─────────┘
```

## Why Combine Gateway and Orchestrator?

### Before (Separate Services)
```
Frontend → Gateway → Orchestrator → BFF → Services
           [Auth]    [Orchestrate]
```
- Extra network hop
- Duplicate configuration
- More services to manage
- Higher latency

### After (Unified Service)
```
Frontend → Orchestrator → BFF → Services
           [Auth + Orchestrate]
```
- Single entry point
- Unified configuration
- Simpler deployment
- Lower latency

## Core Capabilities

### 1. Gateway Functions

#### JWT Authentication
- Validates JWT tokens
- Extracts user information (userId, username, role)
- Adds user context headers for downstream services

#### Request Routing
- Routes requests to appropriate backend services
- Supports path-based routing
- Maintains original request context

#### User Context Injection
Adds headers to all authenticated requests:
- `X-User-Id`: User ID
- `X-User-Username`: Username
- `X-User-Role`: User role

### 2. Orchestration Functions

#### Multi-Service Coordination
Combines multiple API calls into single endpoint:

```java
// Example: Address Profile Endpoint
GET /api/v1/orchestration/address-profile/{address}

// Internally calls:
1. GET /api/v1/addresses/{address}        // Address info
2. POST /api/v1/risk/score                // Risk score
3. GET /api/v1/addresses/{address}/transfers // Recent transfers

// Returns combined result
```

#### Parallel Execution
```java
Mono.zip(
    addressInfoMono,    // Call 1
    riskScoreMono,      // Call 2
    transfersMono       // Call 3
).map(tuple -> combineResults(tuple))
```

#### Partial Failure Tolerance
```java
addressInfoMono.onErrorResume(e -> 
    Mono.just(Map.of("error", "Address info unavailable"))
)
```

### 3. Resilience Functions

#### Circuit Breaker
- Prevents cascading failures
- Opens circuit after 50% failure rate
- Half-open state after 10s
- Automatic recovery

#### Rate Limiting
- Per-user rate limiting
- 100 requests per second per user
- Redis-backed for distributed scenarios
- Immediate failure on limit exceeded

#### Fallback/Degradation
- Graceful degradation when services fail
- Returns meaningful error messages
- Maintains service availability

#### Retry
- Automatic retry for transient failures
- Max 3 attempts
- 1s wait between retries

## Endpoints

### Gateway Routes (Proxy)

| Route | Target | Auth | Resilience |
|-------|--------|------|------------|
| `/api/v1/auth/**` | BFF | ❌ No | ✅ Circuit Breaker |
| `/api/v1/addresses/**` | BFF | ✅ Yes | ✅ Circuit Breaker |
| `/api/v1/risk/**` | BFF | ✅ Yes | ✅ Circuit Breaker |

### Orchestration Routes (Complex)

| Route | Description | Services Called |
|-------|-------------|-----------------|
| `GET /api/v1/orchestration/address-profile/{address}` | Comprehensive address profile | Address + Risk + Transfers |
| `POST /api/v1/orchestration/batch-risk-analysis` | Batch risk analysis | Multiple risk scoring calls |

### Fallback Routes

| Route | Purpose |
|-------|---------|
| `/fallback/bff` | BFF service unavailable |
| `/fallback/generic` | Generic error fallback |

## Configuration

### Application Properties

```yaml
server:
  port: 8080

spring:
  cloud:
    gateway:
      routes:
        - id: address-route
          uri: http://localhost:3001
          predicates:
            - Path=/api/v1/addresses/**
          filters:
            - AuthenticationFilter
            - CircuitBreaker

resilience4j:
  circuitbreaker:
    instances:
      bffCircuitBreaker:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 10s
  
  ratelimiter:
    instances:
      default:
        limitForPeriod: 100
        limitRefreshPeriod: 1s
```

### Environment Variables

```bash
PORT=8080
JWT_SECRET=your-secret-key
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Request Flow

### Simple Request (Gateway Mode)
```
1. Frontend sends request with JWT
   GET /api/v1/addresses/0x123...
   Authorization: Bearer <jwt>

2. Orchestrator validates JWT
   - Extract user info
   - Add headers: X-User-Id, X-User-Username, X-User-Role

3. Orchestrator routes to BFF
   GET http://bff:3001/api/v1/addresses/0x123...
   X-User-Id: 1
   X-User-Username: admin
   X-User-Role: admin

4. BFF processes request
   - Trust user headers
   - Call backend services
   - Return response

5. Orchestrator returns response to frontend
```

### Complex Request (Orchestration Mode)
```
1. Frontend sends request
   GET /api/v1/orchestration/address-profile/0x123...
   Authorization: Bearer <jwt>

2. Orchestrator validates JWT
   - Extract user info

3. Orchestrator calls multiple APIs in parallel
   ├─ GET /api/v1/addresses/0x123...
   ├─ POST /api/v1/risk/score
   └─ GET /api/v1/addresses/0x123.../transfers

4. Orchestrator combines results
   {
     "addressInfo": {...},
     "riskScore": {...},
     "recentTransfers": {...}
   }

5. Return combined response
```

## Resilience in Action

### Circuit Breaker Example
```
1. BFF service starts failing
2. After 5 failures in 10 requests (50%)
3. Circuit opens - stop calling BFF
4. Return fallback response immediately
5. After 10s, try again (half-open)
6. If successful, close circuit
```

### Rate Limiting Example
```
1. User makes 100 requests in 1 second
2. Request 101 is rejected
3. Response: 429 Too Many Requests
4. After 1 second, limit resets
```

## Monitoring

### Actuator Endpoints

- `GET /actuator/health` - Service health
- `GET /actuator/metrics` - Metrics
- `GET /actuator/circuitbreakers` - Circuit breaker status
- `GET /actuator/ratelimiters` - Rate limiter status

### Metrics to Monitor

- Request rate
- Error rate
- Circuit breaker state
- Rate limiter rejections
- Response time (p50, p95, p99)

## Advantages

| Aspect | Before (Gateway + Orchestrator) | After (Unified) |
|--------|--------------------------------|-----------------|
| **Latency** | 2 network hops | 1 network hop |
| **Deployment** | 2 services | 1 service |
| **Configuration** | Duplicate | Unified |
| **Observability** | 2 services to monitor | 1 service |
| **Cost** | Higher resource usage | Lower resource usage |
| **Complexity** | Higher | Lower |

## Development

### Adding New Orchestration

1. **Add API client method** in `BffClient.java`
```java
public Mono<Map<String, Object>> getNewData(...) {
    return webClient.get()...
}
```

2. **Create orchestration endpoint** in `OrchestrationController.java`
```java
@GetMapping("/new-endpoint")
public Mono<ResponseEntity<Map<String, Object>>> newEndpoint(...) {
    return Mono.zip(call1, call2, call3)
        .map(tuple -> combineResults(tuple));
}
```

3. **Add route** in `application.yml` (if needed)

## Best Practices

1. **Always use Circuit Breaker** for external calls
2. **Implement fallback** for all critical paths
3. **Set appropriate timeouts** for each service
4. **Monitor circuit breaker** state changes
5. **Use parallel execution** when calls are independent
6. **Handle partial failures** gracefully
7. **Log orchestration** decisions for debugging

## Migration from Separate Gateway

### What Changed
- ✅ Gateway merged into Orchestrator
- ✅ All Gateway functionality preserved
- ✅ Added orchestration capabilities
- ✅ Added resilience features
- ✅ Simplified deployment

### What Stayed
- ✅ JWT authentication logic
- ✅ User context injection
- ✅ Request routing
- ✅ CORS configuration
- ✅ API contracts
