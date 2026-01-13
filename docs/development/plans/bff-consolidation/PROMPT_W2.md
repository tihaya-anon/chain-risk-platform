# Worker 2 Prompt: Orchestration + Infrastructure Track

## Context

You are implementing the BFF consolidation refactor for a blockchain risk analysis platform. Your track focuses on migrating orchestration logic and cleaning up infrastructure.

## Your Tasks

Execute CP2 and CP4 sequentially:

### CP2: Orchestration Migration (Day 1)

**Goal**: Migrate aggregation endpoints from Java Orchestrator to NestJS BFF

**Steps**:

1. Create orchestration module:
```
services/bff/src/modules/orchestration/
├── orchestration.module.ts
├── orchestration.controller.ts
├── orchestration.service.ts
└── orchestration.dto.ts
```

2. Implement 4 aggregation endpoints:

| Endpoint | Services | Logic |
|----------|----------|-------|
| `GET /api/v1/orchestration/address-profile/:address` | query + risk | Parallel call, merge results |
| `GET /api/v1/orchestration/address-analysis/:address` | query + risk + graph | Parallel call, merge results |
| `GET /api/v1/orchestration/connection/:from/:to` | graph + risk | Get path, enrich with risk |
| `GET /api/v1/orchestration/high-risk-network` | graph | Direct proxy |

3. Use `Promise.all` for parallel calls

4. Inject `ResilienceService` (from CP1) for circuit breaker - if not ready yet, add TODO comment

5. Add OpenAPI decorators (@ApiOperation, @ApiResponse)

6. Add unit tests

**Validation**:
```bash
npm run build
npm run test
curl http://localhost:3001/api/v1/orchestration/address-profile/0x123
```

### CP4: Docker/Infra Cleanup (Day 2, after CP2)

**Goal**: Remove orchestrator from infrastructure

**Steps**:

1. Update `docker-compose.yml`:
   - Remove `orchestrator` service block
   - Update `frontend.depends_on`: change `orchestrator` → `bff`

2. Update `Makefile`:
   - Remove orchestrator targets
   - Update `start` target

3. Update `tests/api/config/environments.js`:
   - Remove `orchestrator` entries (or keep as alias to bff for compatibility)

4. Do NOT delete `services/orchestrator/` yet - wait for CP5 validation

**Validation**:
```bash
docker-compose config  # should be valid
make start  # should work without orchestrator
```

## Branch Strategy

```bash
git checkout refactor/bff-consolidation
git checkout -b refactor/cp2-orchestration

# Work on CP2...
git add -A
git commit -m "feat(bff): add orchestration module with aggregation endpoints"

# Continue to CP4 on same branch
git commit -m "chore(infra): remove orchestrator from docker-compose"

# Push
git push origin refactor/cp2-orchestration
```

## Coordination

- You can start immediately (no dependencies)
- CP2 can reference ResilienceService even if CP1 not done (inject with `@Optional()`)
- After CP4 complete, coordinate with W1 for joint CP5 validation

## Files You'll Modify

**CP2**:
- `services/bff/src/app.module.ts` - import OrchestrationModule
- New: `services/bff/src/modules/orchestration/*`

**CP4**:
- `docker-compose.yml`
- `Makefile`
- `tests/api/config/environments.js`

## Reference: Current Orchestrator Endpoints

Check Java implementation at:
- `services/orchestrator/src/main/java/com/chainrisk/orchestrator/controller/`
- `services/orchestrator/src/main/java/com/chainrisk/orchestrator/service/`

Key patterns to preserve:
- Parallel service calls
- Error aggregation
- Response merging

## Definition of Done

- [ ] OrchestrationModule created
- [ ] All 4 endpoints working
- [ ] OpenAPI docs generated
- [ ] Unit tests pass
- [ ] docker-compose.yml updated
- [ ] Makefile updated
- [ ] Test config updated
- [ ] Services start without orchestrator
