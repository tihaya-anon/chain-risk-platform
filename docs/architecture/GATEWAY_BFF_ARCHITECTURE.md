# Gateway + Orchestrator + BFF Architecture

## Overview

```
┌─────────────┐
│   Frontend  │  ← Only one entry point: orchestrator:8080
│    :5173    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Java Orchestrator (:8080)                        │
│                                                                         │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │         Gateway Layer           │  │     Orchestration Layer      │  │
│  │                                 │  │                              │  │
│  │  • JWT Authentication           │  │  • Complex Aggregation       │  │
│  │  • Rate Limiting                │  │  • Resilience4j              │  │
│  │  • Circuit Breaker              │  │    - Circuit Breaker         │  │
│  │  • Request Routing              │  │    - Retry                   │  │
│  │  • User Context Injection       │  │    - Timeout                 │  │
│  │  • CORS                         │  │  • Parallel API Calls        │  │
│  └─────────────────────────────────┘  └──────────────────────────────┘  │
│                                                                         │
│  /api/v1/orchestration/*  → Self-handled (aggregation + resilience)     │
│  /api/v1/**               → Route to BFF (with user context headers)    │
└───────────┬─────────────────────────────────────┬───────────────────────┘
            │                                     │
            │ Direct call (aggregation)           │ Passthrough
            ▼                                     ▼
┌─────────────────────────┐             ┌─────────────────────────┐
│   Backend Services      │             │     NestJS BFF (:3001)  │
│                         │             │                         │
│   • query-service       │             │  • API Transformation   │
│   • risk-ml-service     │             │  • DTO Validation       │
│   • graph-service       │             │  • Service Aggregation  │
│                         │             │  • Native TS Types      │
└─────────────────────────┘             └───────────┬─────────────┘
                                                    │
                                                    ▼
                                        ┌─────────────────────────┐
                                        │   Backend Services      │
                                        └─────────────────────────┘
```

## Request Flow

### Simple Query (via BFF)
```
Frontend → Orchestrator → BFF → Service
              │
              └─ JWT verify, add X-User-* headers, passthrough
```

### Complex Aggregation (via Orchestrator)
```
Frontend → Orchestrator ──┬──→ query-service
              │           ├──→ risk-ml-service    (parallel calls)
              │           └──→ graph-service
              │
              └─ JWT verify, Resilience4j, aggregate results
```

## Responsibilities

### Java Orchestrator
**Port**: 8080

| Category | Responsibilities |
|----------|------------------|
| **Gateway** | JWT validation, Rate limiting, Circuit breaker, CORS, Request logging |
| **Routing** | Route `/api/v1/**` to BFF, Inject user context headers |
| **Orchestration** | Complex aggregation APIs, Resilience4j (retry/timeout/circuit breaker) |

**Tech Stack Showcase**:
- Spring Cloud Gateway
- Resilience4j
- WebFlux (Reactive)
- Spring Security

### NestJS BFF
**Port**: 3001

| Category | Responsibilities |
|----------|------------------|
| **API** | Transform service responses, DTO validation, OpenAPI generation |
| **Aggregation** | Simple service composition, Data formatting |
| **Types** | Native TypeScript types → Frontend code generation |

**Tech Stack Showcase**:
- NestJS modules/guards/interceptors
- Class-validator / class-transformer
- @nestjs/swagger (OpenAPI)
- Axios HTTP client

### Backend Services
- `query-service`: Address/transaction queries
- `risk-ml-service`: Risk scoring
- `graph-service`: Graph analysis

## Orchestration APIs

Orchestrator provides aggregated endpoints that combine multiple service calls:

| Endpoint | Description | Services Called |
|----------|-------------|-----------------|
| `GET /api/v1/orchestration/address-profile/{address}` | Address overview | query + risk |
| `GET /api/v1/orchestration/address-analysis/{address}` | Full analysis | query + risk + graph |
| `GET /api/v1/orchestration/connection/{from}/{to}` | Path finding | graph + risk |
| `GET /api/v1/orchestration/high-risk-network` | Risk network | graph |

## User Context Headers

Orchestrator injects user context after JWT validation:

```http
GET /api/v1/addresses/0x123 HTTP/1.1
Host: bff:3001
Authorization: Bearer eyJhbGc...
X-User-Id: 1
X-User-Username: admin
X-User-Role: admin
```

### BFF Reception

```typescript
// Option 1: Guard (recommended)
@UseGuards(OrchestratorAuthGuard, JwtAuthGuard)
@Get(':address')
async getAddress(@Request() req) {
  const user = req.user;  // { sub, username, role, fromOrchestrator }
}

// Option 2: Decorator
@Get(':address')
async getAddress(@OrchestratorUser() user: UserInfo) {
  // user: { sub, username, role }
}
```

## Dual Access Mode

BFF supports both access patterns:

| Mode | Path | Use Case |
|------|------|----------|
| **Production** | Frontend → Orchestrator → BFF | Full auth flow |
| **Development** | Frontend → BFF directly | Skip gateway, faster iteration |

## Frontend API Client Generation

```
BFF (NestJS @nestjs/swagger)
         │
         ▼ Auto-generate
   bff.openapi.json
         │
         ▼ orval
┌─────────────────────────┐
│  frontend/src/api/      │
│  ├── models/            │  ← TypeScript DTOs
│  ├── bff.ts             │  ← API client
│  └── bff.msw.ts         │  ← Mock handlers
└─────────────────────────┘
```

## Configuration

### Orchestrator (application.yml)
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: auth-route
          uri: http://bff:3001
          predicates:
            - Path=/api/v1/auth/**
          # No authentication required
        
        - id: bff-route
          uri: http://bff:3001
          predicates:
            - Path=/api/v1/**
          filters:
            - AuthenticationFilter
            - name: CircuitBreaker
              args:
                name: bff-circuit
                fallbackUri: forward:/fallback

resilience4j:
  circuitbreaker:
    instances:
      query-service:
        slidingWindowSize: 10
        failureRateThreshold: 50
      risk-service:
        slidingWindowSize: 10
        failureRateThreshold: 50
  retry:
    instances:
      query-service:
        maxAttempts: 3
        waitDuration: 500ms
```

### BFF (config)
```typescript
export const config = {
  server: { port: 3001 },
  jwt: { secret: process.env.JWT_SECRET },
  services: {
    query: process.env.QUERY_SERVICE_URL,
    risk: process.env.RISK_SERVICE_URL,
    graph: process.env.GRAPH_SERVICE_URL,
  },
};
```

## Environment Variables

### Orchestrator
```bash
JWT_SECRET=your-secret-key-min-256-bits
BFF_URL=http://bff:3001
QUERY_SERVICE_URL=http://query-service:8081
RISK_SERVICE_URL=http://risk-service:8082
GRAPH_SERVICE_URL=http://graph-service:8083
```

### BFF
```bash
JWT_SECRET=your-secret-key-min-256-bits  # Must match Orchestrator
QUERY_SERVICE_URL=http://query-service:8081
RISK_SERVICE_URL=http://risk-service:8082
GRAPH_SERVICE_URL=http://graph-service:8083
```

## Startup Order

1. Infrastructure (PostgreSQL, Neo4j, Redis, Kafka)
2. Backend Services (query-service, risk-ml-service, graph-service)
3. BFF (:3001)
4. Orchestrator (:8080)
5. Frontend (:5173)

## Security

| Layer | Security Measure |
|-------|------------------|
| **Orchestrator** | JWT validation, Rate limiting, CORS |
| **BFF** | Internal network only (not exposed), Request header validation |
| **Services** | Internal network only |

## Monitoring

| Service | Endpoints |
|---------|-----------|
| Orchestrator | `/actuator/health`, `/actuator/metrics`, `/actuator/circuitbreakers` |
| BFF | `/health` |
| Services | `/actuator/health` |

## Why This Architecture?

| Concern | Solution |
|---------|----------|
| Java too heavy for just Gateway? | Orchestrator also handles complex aggregation with Resilience4j |
| Frontend needs native TS types? | BFF generates OpenAPI → orval → TS client |
| Want to showcase both Java & TS? | Java: Spring Cloud + Resilience4j, TS: NestJS ecosystem |
| Simple vs Complex queries? | Simple → BFF passthrough, Complex → Orchestrator aggregation |
