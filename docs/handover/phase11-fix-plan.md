# Phase 11 Fix Plan - Service Fixes & Test Coverage

**Created**: 2026-01-12  
**Branch**: `fix/phase11-service-fixes`  
**Status**: Planning

---

## Executive Summary

API contract tests revealed validation and filtering bugs in `graph-service` and `alert-service`. Root cause: missing unit tests at controller/handler layer.

---

## 1. Service Fixes

### 1.1 graph-service (Java/Spring)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `@Min/@Max` on `@RequestParam` returns 500 | Missing `@Validated` on controller class | Add `@Validated` annotation |
| `POST /tags` returns 500 for valid data | Neo4j node not found, unhandled exception | Add existence check before operation |
| `/admin/config` returns 700KB+ JSON | Spring AOP proxy recursion | Create proper DTO |

**Files to modify**:
```
services/graph-service/src/main/java/com/chainrisk/graph/controller/GraphController.java
services/graph-service/src/main/java/com/chainrisk/graph/service/TagPropagationService.java
```

### 1.2 alert-service (Go/Gin)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `severity` filter ignored | Query param not read in handler | Add severity param handling |

**Files to modify**:
```
services/alert-service/internal/handler/alert_rule_handler.go
services/alert-service/internal/repository/alert_rule_repository.go (if needed)
```

---

## 2. Test Coverage Gaps

### 2.1 Current State

| Service | Unit Tests | Controller/Handler Tests | Status |
|---------|-----------|-------------------------|--------|
| graph-service | ❌ None | ❌ None | Critical |
| alert-service | ⚠️ Partial (engine only) | ❌ None | High |
| query-service | ⚠️ Partial | ❌ None | Medium |
| risk-ml-service | ✅ Present | ⚠️ Partial | OK |
| bff | ✅ Unit + E2E | ✅ Present | OK |

### 2.2 Required Test Additions

**graph-service** - Add under `src/test/java/com/chainrisk/graph/`:
```
controller/
  GraphControllerTest.java        # @WebMvcTest, param validation
  GraphControllerIntegrationTest.java  # @SpringBootTest with TestContainers
service/
  TagPropagationServiceTest.java
```

**alert-service** - Add under `internal/handler/`:
```
alert_rule_handler_test.go   # Table-driven tests for List() with all params
subscription_handler_test.go
```

---

## 3. Process Improvements

### 3.1 CI/CD Gates (Add to `.github/workflows/`)

```yaml
# Minimum coverage enforcement
- name: Check coverage
  run: |
    # Java: JaCoCo 80% line coverage for controller package
    # Go: go test -coverprofile with 70% threshold
```

### 3.2 Pre-merge Checklist

- [ ] Unit tests for new/modified handlers
- [ ] Contract test passes locally
- [ ] OpenAPI spec updated if API changed

### 3.3 Development Workflow

```
Before (current):
  Spec → Implement → Deploy → Find bugs in integration

After (target):
  Spec → Contract test (fail) → Unit test (fail) → Implement → Both pass → Deploy
```

---

## 4. Git Workflow

### 4.1 Branch Strategy

```
main
 └── fix/phase11-service-fixes     # Current branch
      ├── Commit 1: graph-service validation fix
      ├── Commit 2: graph-service POST /tags fix  
      ├── Commit 3: alert-service severity filter fix
      ├── Commit 4: graph-service unit tests
      ├── Commit 5: alert-service handler tests
      └── Commit 6: revert test workarounds, re-run contract tests
```

### 4.2 Commit Sequence

```bash
# Phase A: Service Fixes
git commit -m "fix(graph-service): add @Validated for request param validation"
git commit -m "fix(graph-service): handle missing address in POST /tags"
git commit -m "fix(alert-service): implement severity filter in ListRules"

# Phase B: Test Coverage
git commit -m "test(graph-service): add controller unit tests"
git commit -m "test(alert-service): add handler unit tests"

# Phase C: Cleanup
git commit -m "test(api): revert workarounds, expect correct status codes"

# Final
git push origin fix/phase11-service-fixes
# Create PR → main
```

### 4.3 Validation Steps

```bash
# After each service fix, verify remotely
ssh dev-win "docker-compose restart graph-service"
k6 run tests/api/contracts/graph-service.test.js

# After all fixes
for svc in query-service risk-ml-service alert-service graph-service bff; do
  k6 run tests/api/contracts/${svc}.test.js
done
```

---

## 5. Task Breakdown

### High Priority (Blocking)

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| F1 | graph-service: Add `@Validated` to GraphController | 0.5h | - |
| F2 | graph-service: Fix POST /tags 500 error | 1h | - |
| F3 | alert-service: Add severity filter to List() | 1h | - |

### Medium Priority (Quality)

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| T1 | graph-service: GraphControllerTest.java | 2h | - |
| T2 | alert-service: alert_rule_handler_test.go | 2h | - |
| T3 | Revert contract test workarounds | 0.5h | - |
| T4 | Run full contract test suite, verify 100% pass | 0.5h | - |

### Low Priority (Tech Debt)

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| D1 | graph-service: Fix /admin/config response size | 1h | - |
| D2 | risk-ml-service: Validate hex format for addresses | 1h | - |
| D3 | Add coverage gates to CI | 2h | - |

---

## 6. Success Criteria

- [ ] All contract tests pass with **original expectations** (no workarounds)
- [ ] graph-service controller coverage ≥ 80%
- [ ] alert-service handler coverage ≥ 70%
- [ ] No 500 errors for validation failures

---

## Appendix: Quick Reference

### Run Tests Locally

```bash
# Contract tests
source .env.local
k6 run -e DOCKER_HOST_IP=$DOCKER_HOST_IP tests/api/contracts/graph-service.test.js

# Java unit tests
cd services/graph-service && ./mvnw test

# Go unit tests  
cd services/alert-service && go test ./internal/handler/...
```

### Reproduce Issues

```bash
# graph-service validation (should return 400, currently 500)
curl "$DOCKER_HOST_IP:8084/api/v1/graph/address/0x123/neighbors?depth=10"

# alert-service filter (currently ignores severity)
curl "$DOCKER_HOST_IP:8083/api/v1/alert-rules?severity=high"
```
