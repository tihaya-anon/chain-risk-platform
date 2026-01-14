# CP3: Frontend Configuration Update

> **Worker**: W1  
> **Estimate**: 0.5 day  
> **Dependencies**: CP1  
> **Parallel Group**: B

---

## Objective

Update frontend to connect directly to BFF instead of Orchestrator.

---

## Tasks

### 3.1 Update Environment Variables

```bash
# frontend/.env.development
# Before
VITE_API_BASE_URL=http://localhost:8080

# After
VITE_API_BASE_URL=http://localhost:3001
```

### 3.2 Regenerate API Client

```bash
cd frontend
npm run generate:api  # orval
```

### 3.3 Verify API Client Types

Check generated types match BFF OpenAPI spec:

```bash
# Ensure BFF is running
curl http://localhost:3001/api/docs-json > bff.openapi.json
npx orval
```

### 3.4 Update Docker Environment

```yaml
# docker-compose.yml - frontend service
frontend:
  environment:
    - VITE_API_BASE_URL=http://bff:3001
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Updated env | `frontend/.env.development` |
| Regenerated API | `frontend/src/api/` |
| Updated compose | `docker-compose.yml` |

---

## Validation

| Check | Command |
|-------|---------|
| Frontend builds | `npm run build` |
| API calls work | Browser network tab |
| Types correct | TypeScript compilation |

---

## Completion Criteria

- [ ] Environment variables updated
- [ ] API client regenerated
- [ ] Frontend connects to BFF
- [ ] All API calls functional

---

**Branch**: `refactor/cp1-bff-gateway` (continue from CP1)
