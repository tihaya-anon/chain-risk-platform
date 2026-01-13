# CP4: Docker and Infrastructure Cleanup

> **Worker**: W2  
> **Estimate**: 0.5 day  
> **Dependencies**: CP2  
> **Parallel Group**: B

---

## Objective

Remove orchestrator from infrastructure and update configurations.

---

## Tasks

### 4.1 Update docker-compose.yml

Remove orchestrator service:

```yaml
# Remove this entire block:
# orchestrator:
#   build: ./services/orchestrator
#   ports:
#     - "8080:8080"
#   ...
```

Update service dependencies:

```yaml
frontend:
  depends_on:
    - bff  # was: orchestrator

bff:
  ports:
    - "3001:3001"
  # Add any missing env vars from orchestrator
```

### 4.2 Update Makefile

```makefile
# Remove DIR_ORCHESTRATOR variable
# Update targets that reference orchestrator
.PHONY: start
start:
    docker-compose up -d postgres redis neo4j kafka
    docker-compose up -d query-service risk-ml-service graph-service alert-service
    docker-compose up -d bff  # removed orchestrator
    docker-compose up -d frontend
```

### 4.3 Update Test Configuration

Update `tests/api/config/environments.js`:

```javascript
const environments = {
    local: {
        queryService: 'http://localhost:8081',
        riskMlService: 'http://localhost:8082',
        alertService: 'http://localhost:8083',
        graphService: 'http://localhost:8084',
        // orchestrator removed - BFF handles all
        bff: 'http://localhost:3001',
    },
    // ... same for docker and remote
};

export function getBaseUrl(service) {
    const env = getEnv();
    const urls = {
        'query-service': env.queryService,
        'risk-ml-service': env.riskMlService,
        'alert-service': env.alertService,
        'graph-service': env.graphService,
        'orchestrator': env.bff,  // alias for backward compatibility
        'bff': env.bff,
    };
    return urls[service] || env.bff;
}
```

### 4.4 Update Startup Order in Docs

New order (in README and docs):

1. Infrastructure (PostgreSQL, Neo4j, Redis, Kafka)
2. Backend Services
3. BFF (:3001)
4. Frontend (:5173)

### 4.5 Archive Orchestrator Directory

```bash
# Don't delete yet - wait for CP5 validation
# Just mark as deprecated in this phase
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Updated compose | `docker-compose.yml` |
| Updated Makefile | `Makefile` |
| Updated test config | `tests/api/config/environments.js` |

---

## Validation

| Check | Command |
|-------|---------|
| Compose valid | `docker-compose config` |
| No orchestrator | `docker-compose ps \| grep orchestrator` (empty) |
| Services start | `make start` |
| Tests run | `cd tests/api && npm test` |

---

## Completion Criteria

- [ ] docker-compose.yml updated
- [ ] Makefile updated
- [ ] Test environments.js updated
- [ ] No references to orchestrator:8080 in infra
- [ ] All services start correctly

---

**Branch**: `refactor/cp2-orchestration` (continue from CP2)
