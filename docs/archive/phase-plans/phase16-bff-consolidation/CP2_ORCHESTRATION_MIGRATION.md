# CP2: Orchestration Migration

> **Worker**: W2  
> **Estimate**: 1 day  
> **Dependencies**: None  
> **Parallel Group**: A

---

## Objective

Migrate orchestration endpoints from Java Orchestrator to NestJS BFF.

---

## Tasks

### 2.1 Create Orchestration Module

```typescript
// src/modules/orchestration/orchestration.module.ts
@Module({
  imports: [AddressModule, RiskModule, GraphModule],
  controllers: [OrchestrationController],
  providers: [OrchestrationService],
})
export class OrchestrationModule {}
```

### 2.2 Migrate Endpoints

#### Address Profile (query + risk parallel)

```typescript
// src/modules/orchestration/orchestration.service.ts
async getAddressProfile(address: string) {
  const [addressInfo, riskScore] = await Promise.all([
    this.addressService.getAddress(address),
    this.riskService.getRiskScore(address),
  ]);
  
  return { ...addressInfo, risk: riskScore };
}
```

#### Address Analysis (query + risk + graph parallel)

```typescript
async getAddressAnalysis(address: string) {
  const [addressInfo, riskScore, graphData] = await Promise.all([
    this.addressService.getAddress(address),
    this.riskService.getRiskScore(address),
    this.graphService.getNeighbors(address),
  ]);
  
  return { ...addressInfo, risk: riskScore, graph: graphData };
}
```

#### Connection Path (graph + risk)

```typescript
async getConnection(from: string, to: string) {
  const path = await this.graphService.findPath(from, to);
  const risks = await Promise.all(
    path.nodes.map(n => this.riskService.getRiskScore(n.address))
  );
  
  return { path, risks };
}
```

### 2.3 Add Resilience Wrapper

```typescript
// Use ResilienceService from CP1
async getAddressProfile(address: string) {
  const policy = this.resilience.wrapWithResilience('aggregation');
  
  return policy.execute(async () => {
    const [addressInfo, riskScore] = await Promise.all([
      this.addressService.getAddress(address),
      this.riskService.getRiskScore(address),
    ]);
    return { ...addressInfo, risk: riskScore };
  });
}
```

---

## Endpoint Mapping

| Old (Orchestrator) | New (BFF) |
|--------------------|-----------|
| `GET /api/v1/orchestration/address-profile/:address` | `GET /api/v1/orchestration/address-profile/:address` |
| `GET /api/v1/orchestration/address-analysis/:address` | `GET /api/v1/orchestration/address-analysis/:address` |
| `GET /api/v1/orchestration/connection/:from/:to` | `GET /api/v1/orchestration/connection/:from/:to` |
| `GET /api/v1/orchestration/high-risk-network` | `GET /api/v1/orchestration/high-risk-network` |

---

## Deliverables

| Artifact | Path |
|----------|------|
| Orchestration module | `src/modules/orchestration/` |
| DTOs | `src/modules/orchestration/orchestration.dto.ts` |
| Controller | `src/modules/orchestration/orchestration.controller.ts` |
| Service | `src/modules/orchestration/orchestration.service.ts` |

---

## File Structure

```
services/bff/src/modules/orchestration/
├── orchestration.module.ts
├── orchestration.controller.ts
├── orchestration.service.ts
└── orchestration.dto.ts
```

---

## Validation

| Check | Command |
|-------|---------|
| Build passes | `npm run build` |
| Endpoints respond | `curl localhost:3001/api/v1/orchestration/address-profile/0x123` |
| Parallel calls work | Check timing < sequential |

---

## Completion Criteria

- [ ] OrchestrationModule created
- [ ] All 4 endpoints migrated
- [ ] Resilience patterns applied
- [ ] DTOs with OpenAPI decorators
- [ ] Unit tests for aggregation logic

---

**Branch**: `refactor/cp2-orchestration`
