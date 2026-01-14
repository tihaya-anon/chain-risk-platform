# BFF Architecture

## Overview

```
┌─────────────┐
│   Frontend  │
│    :5173    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                     NestJS BFF (:3001)                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Gateway   │  │    BFF      │  │   Orchestration     │  │
│  │             │  │             │  │                     │  │
│  │ • JWT Auth  │  │ • DTO/Types │  │ • Service Aggreg.   │  │
│  │ • Rate Limit│  │ • OpenAPI   │  │ • Circuit Breaker   │  │
│  │ • CORS      │  │ • Transform │  │ • Parallel Calls    │  │
│  │ • Audit     │  │ • WebSocket │  │ • Error Handling    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────┬─────────────────┬─────────────────┬─────────────────┘
        │                 │                 │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │  Query  │       │  Risk   │       │  Graph  │
   │  :8081  │       │  :8082  │       │  :8084  │
   └─────────┘       └─────────┘       └─────────┘
```

---

## Request Flow

### Simple Query
```
Frontend → BFF → Service → Response
```

### Aggregated Query
```
Frontend → BFF ──┬──→ query-service
                 ├──→ risk-ml-service   (parallel)
                 └──→ graph-service
                      ↓
                 Merge & Return
```

---

## BFF Responsibilities

| Layer | Function |
|-------|----------|
| Gateway | JWT validation, rate limiting, CORS, audit logging |
| BFF | Request/response transformation, OpenAPI docs, WebSocket |
| Orchestration | Service aggregation, circuit breaker, retry/timeout |

---

## Modules

```
src/
├── common/
│   ├── guards/           # JWT, Rate Limit, Roles
│   ├── resilience/       # Circuit Breaker (cockatiel)
│   └── audit/            # Audit logging
├── modules/
│   ├── address/          # Address queries
│   ├── risk/             # Risk scoring
│   ├── graph/            # Graph analysis
│   ├── alert/            # Alert management
│   ├── orchestration/    # Aggregation endpoints
│   └── websocket/        # Real-time alerts
└── config/
    └── tls.ts            # TLS configuration
```

---

## Orchestration Endpoints

| Endpoint | Services | Description |
|----------|----------|-------------|
| `GET /orchestration/address-profile/:addr` | query + risk | Address with risk score |
| `GET /orchestration/address-analysis/:addr` | query + risk + graph | Full analysis |
| `GET /orchestration/connection/:from/:to` | graph + risk | Path with risk |
| `GET /orchestration/high-risk-network` | graph | High risk subgraph |

---

## Circuit Breaker

```typescript
// Usage
const result = await circuitBreakerService.wrapWithResilience(
  'query-service',
  () => httpService.get('/api/v1/addresses/' + address)
);
```

**Config**:
- Timeout: 5s
- Retry: 3x with exponential backoff
- Circuit opens after 5 consecutive failures
- Half-open after 30s

---

## Security

| Feature | Implementation |
|---------|---------------|
| Auth | JWT Bearer token validation |
| Rate Limit | Per-IP, configurable per route |
| TLS | Optional TLS server mode |
| Audit | All requests logged with user context |

---

**Updated**: 2026-01-14
