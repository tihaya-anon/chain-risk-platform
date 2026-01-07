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
└───────────┬─────────────────────────────────────────────────────────────┘
            │
            │ Passthrough (with X-User-* headers)
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NestJS BFF (:3001)                              │
│                                                                         │
│  • API Transformation    • DTO Validation    • Native TS Types          │
│  • Service Aggregation   • OpenAPI Generation                           │
└───────────┬─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend Services                                │
│                                                                         │
│        query-service        risk-ml-service        graph-service        │
└─────────────────────────────────────────────────────────────────────────┘
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

**Tech Stack Showcase**: Spring Cloud Gateway, Resilience4j, WebFlux, Spring Security

### NestJS BFF
**Port**: 3001

| Category | Responsibilities |
|----------|------------------|
| **API** | Transform service responses, DTO validation, OpenAPI generation |
| **Aggregation** | Simple service composition, Data formatting |
| **Types** | Native TypeScript types → Frontend code generation |

**Tech Stack Showcase**: NestJS modules/guards/interceptors, class-validator, @nestjs/swagger

### Backend Services
- `query-service`: Address/transaction queries
- `risk-ml-service`: Risk scoring
- `graph-service`: Graph analysis

## Orchestration APIs

| Endpoint | Description | Services Called |
|----------|-------------|-----------------|
| `GET /orchestration/address-profile/{address}` | Address overview | query + risk |
| `GET /orchestration/address-analysis/{address}` | Full analysis | query + risk + graph |
| `GET /orchestration/connection/{from}/{to}` | Path finding | graph + risk |
| `GET /orchestration/high-risk-network` | Risk network | graph |

## User Context Headers

Orchestrator injects after JWT validation:

```http
GET /api/v1/addresses/0x123 HTTP/1.1
Authorization: Bearer eyJhbGc...
X-User-Id: 1
X-User-Username: admin
X-User-Role: admin
```

## Frontend API Client Generation

```
BFF (@nestjs/swagger) → bff.openapi.json → orval → frontend/src/api/
```

## Configuration

### Orchestrator (application.yml)
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: bff-route
          uri: http://bff:3001
          predicates:
            - Path=/api/v1/**
          filters:
            - AuthenticationFilter

resilience4j:
  circuitbreaker:
    instances:
      query-service:
        slidingWindowSize: 10
        failureRateThreshold: 50
  retry:
    instances:
      query-service:
        maxAttempts: 3
        waitDuration: 500ms
```

## Startup Order

1. Infrastructure (PostgreSQL, Neo4j, Redis, Kafka)
2. Backend Services
3. BFF (:3001)
4. Orchestrator (:8080)
5. Frontend (:5173)

---

## Future: RBAC Design

### Layered RBAC Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RBAC Architecture                               │
│                                                                         │
│  ┌─────────────┐                      ┌─────────────┐                   │
│  │ user-role   │                      │ role-access │                   │
│  │     DB      │                      │     DB      │                   │
│  └──────┬──────┘                      └──────┬──────┘                   │
│         │                                    │                          │
│         ▼                                    ▼                          │
│  ┌─────────────────────────┐    ┌─────────────────────────┐             │
│  │    Java Orchestrator    │    │      NestJS BFF         │             │
│  │                         │    │                         │             │
│  │    Coarse-grained:      │    │    Fine-grained:        │             │
│  │    • Dept → DB access   │───▶│    • Endpoint-level     │             │
│  │    • Orchestration      │    │    • Field filtering    │             │
│  │      API permission     │    │    • Operation control  │             │
│  │                         │    │                         │             │
│  │    Inject:              │    │    Consume:             │             │
│  │    X-User-Roles         │    │    X-User-* headers     │             │
│  │    X-User-Department    │    │    Query role-access    │             │
│  │    X-User-DataScope     │    │                         │             │
│  └─────────────────────────┘    └─────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
```

### RBAC Responsibilities

| Layer | Granularity | Examples |
|-------|-------------|----------|
| **Orchestrator** | Coarse | `dept:compliance` can access `risk` DB<br>`role:analyst` can use `/orchestration/*` |
| **BFF** | Fine | `GET /addresses/:id` requires `address:read`<br>`POST /risk/batch` requires `risk:write` |

### Data Model

```sql
-- user-role DB (Orchestrator)
CREATE TABLE user_roles (
  user_id     BIGINT,
  role        VARCHAR(50),   -- 'analyst', 'admin', 'viewer'
  department  VARCHAR(50),   -- 'compliance', 'trading', 'risk'
  data_scope  VARCHAR(50)[]  -- ['ethereum', 'bsc']
);

-- role-access DB (BFF)
CREATE TABLE role_permissions (
  role        VARCHAR(50),
  resource    VARCHAR(100),  -- 'address', 'risk', 'graph'
  action      VARCHAR(20),   -- 'read', 'write', 'delete'
  conditions  JSONB          -- {"max_batch_size": 100}
);
```

### RBAC Request Flow

```
1. Frontend (JWT)
        │
        ▼
2. Orchestrator:
   - JWT → user_id
   - Query user-role DB → roles, department, data_scope
   - Coarse check: Can this department access this API?
   - Inject headers:
       X-User-Id: 123
       X-User-Roles: ["analyst"]
       X-User-Department: compliance
       X-User-DataScope: ["ethereum","bsc"]
        │
        ▼
3. BFF:
   - Read X-User-* headers
   - Query role-access DB (cached in Redis)
   - Fine check: Can analyst read /addresses/:id?
   - Field filtering based on conditions
```

### Implementation Notes

1. **Caching**: Cache role-permission mappings in Redis
2. **Inheritance**: `admin` > `analyst` > `viewer`
3. **Data Scope**: `data_scope` controls which chains user can query

---

## Why This Architecture?

| Concern | Solution |
|---------|----------|
| Java too heavy for just Gateway? | Orchestrator handles Gateway + Aggregation + Coarse RBAC |
| Frontend needs native TS types? | BFF generates OpenAPI → orval → TS client |
| Want to showcase both Java & TS? | Java: Spring Cloud + Resilience4j, TS: NestJS ecosystem |
| RBAC complexity? | Coarse at Gateway, Fine at BFF |
