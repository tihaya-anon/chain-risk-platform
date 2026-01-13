# BFF Consolidation: Remove Orchestrator Layer

> **Status**: Planning  
> **Priority**: Medium  
> **Estimate**: 3-4 days (parallel execution)

---

## Motivation

Current architecture has unnecessary complexity:

```
Current:  Frontend → Orchestrator(:8080) → BFF(:3001) → Services  (3 hops)
Target:   Frontend → BFF(:3001) → Services                        (2 hops)
```

| Issue | Impact |
|-------|--------|
| Extra network hop | +1-5ms latency per request |
| Two auth implementations | Maintenance burden, inconsistency risk |
| Java + TS runtime | Double operational overhead |
| Gateway + Orchestration coupled | Violation of single responsibility |

---

## Checkpoint Structure

| CP | Task | Est | Worker | Depends | Parallel |
|----|------|-----|--------|---------|----------|
| 1 | BFF Gateway Capabilities | 1d | W1 | - | A |
| 2 | Orchestration Migration | 1d | W2 | - | A |
| 3 | Frontend Config Update | 0.5d | W1 | CP1 | B |
| 4 | Docker/Infra Cleanup | 0.5d | W2 | CP2 | B |
| 5 | Validation & Cleanup | 0.5d | W1+W2 | CP3,4 | C |

---

## Dependency DAG

```
┌────────────────────────────────────────────┐
│            PARALLEL GROUP A                │
│   ┌──────────────┐    ┌──────────────┐     │
│   │     CP1      │    │     CP2      │     │
│   │ BFF Gateway  │    │ Orchestration│     │
│   │ Capabilities │    │  Migration   │     │
│   └──────┬───────┘    └──────┬───────┘     │
└──────────┼───────────────────┼─────────────┘
           │                   │
           ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│       CP3        │  │       CP4        │
│ Frontend Config  │  │  Docker Cleanup  │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
            ┌──────────────┐
            │     CP5      │
            │  Validation  │
            └──────────────┘
```

---

## Worker Assignment

### Worker 1 (BFF + Frontend Track)

| Order | CP | Task |
|-------|----|----|
| 1 | CP1 | Add Gateway capabilities to BFF |
| 2 | CP3 | Update frontend API configuration |
| 3 | CP5 | Joint validation |

### Worker 2 (Orchestration + Infra Track)

| Order | CP | Task |
|-------|----|----|
| 1 | CP2 | Migrate orchestration endpoints to BFF |
| 2 | CP4 | Remove orchestrator from docker-compose |
| 3 | CP5 | Joint validation |

---

## Migration Scope

### Capabilities to Move to BFF

| From Orchestrator | To BFF | Implementation |
|-------------------|--------|----------------|
| JWT Auth | `@nestjs/passport` + `passport-jwt` | Already exists |
| Rate Limiting | `@nestjs/throttler` | Already exists |
| Circuit Breaker | `cockatiel` or `opossum` | New |
| User Context Headers | Guards + Interceptors | Already exists |
| CORS | NestJS built-in | Already exists |

### Orchestration Endpoints to Migrate

| Endpoint | Logic | Target Module |
|----------|-------|---------------|
| `/orchestration/address-profile/{address}` | query + risk parallel | `address.service.ts` |
| `/orchestration/address-analysis/{address}` | query + risk + graph parallel | `address.service.ts` |
| `/orchestration/connection/{from}/{to}` | graph + risk | `graph.service.ts` |
| `/orchestration/high-risk-network` | graph | `graph.service.ts` |

---

## Architecture After Refactor

```
┌─────────────┐
│   Frontend  │
│    :5173    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS BFF (:3001)                         │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Gateway Layer  │  │   BFF Layer     │  │  Orchestration  │  │
│  │                 │  │                 │  │                 │  │
│  │  • JWT Auth     │  │  • DTO/Types    │  │  • Aggregation  │  │
│  │  • Rate Limit   │  │  • OpenAPI      │  │  • Resilience   │  │
│  │  • CORS         │  │  • Transform    │  │  • Parallel     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                           │
│    query-service    risk-ml-service    graph-service    alert   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

| Criteria | Validation |
|----------|------------|
| All existing APIs work | E2E tests pass |
| Orchestration endpoints work | Manual test + unit tests |
| No orchestrator container | `docker ps` shows no orchestrator |
| Frontend connects to BFF directly | Network inspection |
| Latency reduced | Before/after comparison |

---

## Timeline (Parallel Execution)

```
Day 1:  CP1 ████████████████  CP2 ████████████████
Day 2:  CP1 ████              CP2 ████
        CP3 ████████████      CP4 ████████████
Day 3:  CP5 ████████████████████████████████████
```

---

## Deliverables

| CP | Artifacts |
|----|-----------|
| 1 | `src/common/resilience/`, updated guards |
| 2 | New aggregation methods in services |
| 3 | Updated `frontend/.env`, API client regen |
| 4 | Updated `docker-compose.yml`, removed orchestrator dir |
| 5 | Test results, updated architecture docs |

---

## Checkpoint Documents

| CP | Document |
|----|----------|
| 1 | [CP1_BFF_GATEWAY_MERGE.md](./CP1_BFF_GATEWAY_MERGE.md) |
| 2 | [CP2_ORCHESTRATION_MIGRATION.md](./CP2_ORCHESTRATION_MIGRATION.md) |
| 3 | [CP3_FRONTEND_CONFIG.md](./CP3_FRONTEND_CONFIG.md) |
| 4 | [CP4_DOCKER_CLEANUP.md](./CP4_DOCKER_CLEANUP.md) |
| 5 | [CP5_VALIDATION.md](./CP5_VALIDATION.md) |

---

## Branch Strategy

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b refactor/bff-consolidation

# Workers create sub-branches
git checkout -b refactor/cp1-bff-gateway      # W1
git checkout -b refactor/cp2-orchestration    # W2
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing APIs | Keep same route paths, run E2E before merge |
| Missing resilience | Add circuit breaker before removing orchestrator |
| Frontend downtime | Update config as last step, test locally first |

---

## Post-Refactor Cleanup

- [ ] Delete `services/orchestrator/` directory
- [ ] Update `docs/architecture/` to reflect new architecture
- [ ] Archive `GATEWAY_BFF_ARCHITECTURE.md`
- [ ] Update README.md

---

**Created**: 2025-01-13
