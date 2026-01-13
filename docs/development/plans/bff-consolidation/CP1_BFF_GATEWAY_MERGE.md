# CP1: BFF Gateway Capabilities

> **Worker**: W1  
> **Estimate**: 1 day  
> **Dependencies**: None  
> **Parallel Group**: A

---

## Objective

Add missing gateway capabilities to BFF, preparing it to be the single entry point.

---

## Tasks

### 1.1 Circuit Breaker Setup

Install and configure `cockatiel` for resilience patterns.

```bash
cd services/bff
npm install cockatiel
```

Create resilience module:

```typescript
// src/common/resilience/circuit-breaker.service.ts
import { Injectable } from '@nestjs/common';
import { 
  CircuitBreakerPolicy, 
  ConsecutiveBreaker,
  retry,
  circuitBreaker,
  timeout,
  wrap
} from 'cockatiel';

@Injectable()
export class ResilienceService {
  private breakers = new Map<string, CircuitBreakerPolicy>();

  getPolicy(serviceName: string) {
    if (!this.breakers.has(serviceName)) {
      const breaker = circuitBreaker({
        halfOpenAfter: 10_000,
        breaker: new ConsecutiveBreaker(5),
      });
      this.breakers.set(serviceName, breaker);
    }
    return this.breakers.get(serviceName);
  }

  wrapWithResilience(serviceName: string) {
    return wrap(
      timeout(5000),
      retry({ maxAttempts: 3 }),
      this.getPolicy(serviceName)
    );
  }
}
```

### 1.2 Verify Rate Limiting

Confirm `@nestjs/throttler` is properly configured:

```typescript
// src/app.module.ts - verify exists
ThrottlerModule.forRoot({
  throttlers: [{ ttl: 60000, limit: 100 }],
}),
```

### 1.3 Verify JWT Auth

Confirm JWT strategy handles all auth needs:

```typescript
// src/common/guards/jwt-auth.guard.ts - verify exists
// Should extract user and inject into request
```

### 1.4 Add Health Aggregation

```typescript
// src/common/health/health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    // Check downstream services
    return { status: 'ready', services: { ... } };
  }
}
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Resilience module | `src/common/resilience/` |
| Circuit breaker service | `src/common/resilience/circuit-breaker.service.ts` |
| Updated app module | `src/app.module.ts` |

---

## File Changes

### New Files

```
services/bff/src/common/resilience/
├── index.ts
├── circuit-breaker.service.ts
└── resilience.module.ts
```

### Modified Files

| File | Change |
|------|--------|
| `src/app.module.ts` | Import ResilienceModule |
| `package.json` | Add cockatiel dependency |

---

## Validation

| Check | Command |
|-------|---------|
| Build passes | `npm run build` |
| Tests pass | `npm run test` |
| Circuit breaker works | Unit test with mock failures |

---

## Completion Criteria

- [ ] cockatiel installed
- [ ] ResilienceService created
- [ ] ResilienceModule exported
- [ ] App module imports ResilienceModule
- [ ] Unit tests for circuit breaker

---

**Branch**: `refactor/cp1-bff-gateway`
