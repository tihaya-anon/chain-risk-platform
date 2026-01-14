# Worker 1 Prompt: BFF + Frontend Track

## Context

You are implementing the BFF consolidation refactor for a blockchain risk analysis platform. Your track focuses on enhancing BFF capabilities and updating frontend configuration.

## Your Tasks

Execute CP1 and CP3 sequentially:

### CP1: BFF Gateway Capabilities (Day 1)

**Goal**: Add circuit breaker/resilience to BFF

**Steps**:

1. Install cockatiel:
```bash
cd services/bff
npm install cockatiel
```

2. Create resilience module at `src/common/resilience/`:
```
src/common/resilience/
├── index.ts
├── circuit-breaker.service.ts
└── resilience.module.ts
```

3. Implement `CircuitBreakerService`:
   - Use `cockatiel` library
   - Create breaker instances per downstream service
   - Wrap with timeout (5s) + retry (3x) + circuit breaker
   - Export `wrapWithResilience(serviceName)` method

4. Register in `app.module.ts`

5. Add unit tests for circuit breaker behavior

**Validation**:
```bash
npm run build
npm run test
```

### CP3: Frontend Config (Day 2, after CP1)

**Goal**: Point frontend directly to BFF

**Steps**:

1. Update `frontend/.env.development`:
```
VITE_API_BASE_URL=http://localhost:3001
```

2. Update `frontend/.env.production`:
```
VITE_API_BASE_URL=http://bff:3001
```

3. Regenerate API client:
```bash
cd frontend
npm run generate:api
```

4. Verify TypeScript types match

**Validation**:
```bash
npm run build
npm run type-check
```

## Branch Strategy

```bash
git checkout refactor/bff-consolidation
git checkout -b refactor/cp1-bff-gateway

# Work on CP1...
git add -A
git commit -m "feat(bff): add circuit breaker resilience module"

# Continue to CP3 on same branch
git commit -m "feat(frontend): update API base URL to BFF direct"

# Push
git push origin refactor/cp1-bff-gateway
```

## Coordination

- You can start immediately (no dependencies)
- After CP1 complete, notify W2 (though they don't depend on you)
- After CP3 complete, wait for W2's CP4, then jointly do CP5

## Files You'll Modify

**CP1**:
- `services/bff/package.json` - add cockatiel
- `services/bff/src/app.module.ts` - import ResilienceModule
- New: `services/bff/src/common/resilience/*`

**CP3**:
- `frontend/.env.development`
- `frontend/.env.production`
- `frontend/src/api/*` (regenerated)

## Definition of Done

- [ ] cockatiel installed and working
- [ ] ResilienceService with circuit breaker
- [ ] Unit tests pass
- [ ] Frontend env updated
- [ ] API client regenerated
- [ ] Frontend builds successfully
