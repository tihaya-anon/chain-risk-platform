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
# Update targets that reference orchestrator
.PHONY: start
start:
    docker-compose up -d postgres redis neo4j kafka
    docker-compose up -d query-service risk-ml-service graph-service alert-service
    docker-compose up -d bff  # removed orchestrator
    docker-compose up -d frontend
```

### 4.3 Update Startup Order

New order (in README and docs):

1. Infrastructure (PostgreSQL, Neo4j, Redis, Kafka)
2. Backend Services
3. BFF (:3001)
4. Frontend (:5173)

### 4.4 Archive Orchestrator Directory

```bash
# Don't delete yet - archive for reference
git mv services/orchestrator services/_archived_orchestrator
# Or simply delete after validation
rm -rf services/orchestrator
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Updated compose | `docker-compose.yml` |
| Updated Makefile | `Makefile` |
| Archived orchestrator | `services/_archived_orchestrator/` or deleted |

---

## Validation

| Check | Command |
|-------|---------|
| Compose valid | `docker-compose config` |
| No orchestrator | `docker-compose ps \| grep orchestrator` (empty) |
| Services start | `make start` |

---

## Completion Criteria

- [ ] docker-compose.yml updated
- [ ] Makefile updated
- [ ] No references to orchestrator in infra
- [ ] All services start correctly

---

**Branch**: `refactor/cp2-orchestration` (continue from CP2)
