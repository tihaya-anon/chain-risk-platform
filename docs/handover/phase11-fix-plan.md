# Phase 11 Fix Plan - Service Fixes & Test Coverage

**Created**: 2026-01-12  
**Branch**: `fix/phase11-service-fixes`  
**Status**: ✅ Complete

---

## Summary

Fixed validation and filtering bugs in `graph-service` and `alert-service` discovered during API contract testing. Added unit tests to prevent regression.

---

## Completed Tasks

### Service Fixes

| ID | Task | Commit |
|----|------|--------|
| ✅ F1 | graph-service: Add `@Validated` to GraphController | `13322b3` |
| ✅ F2 | graph-service: Fix POST /tags 500 error | `a2b4ab1` |
| ✅ F3 | alert-service: Implement severity filter | `3651fbc` |

### Test Coverage

| ID | Task | Commit |
|----|------|--------|
| ✅ T1 | graph-service: GraphControllerTest.java | `74e1f87` |
| ✅ T2 | alert-service: alert_rule_handler_test.go | `ad630ba` |
| ✅ T3 | Revert contract test workarounds | `81cee8e` |

---

## Changes Summary

### graph-service (Java/Spring)

**Files modified:**
- `controller/GraphController.java` - Added `@Validated`, improved error handling
- `controller/GlobalExceptionHandler.java` - Added `ConstraintViolationException` handler
- `service/impl/BfsTagPropagationService.java` - Use MERGE for new addresses
- `model/dto/AddTagRequest.java` - Changed `@NotBlank` to `@NotEmpty`

**New files:**
- `controller/GraphControllerTest.java` - 15 test cases

### alert-service (Go)

**Files modified:**
- `handler/alert_rule_handler.go` - Parse severity, rule_type query params
- `repository/alert_rule_repository.go` - Added `AlertRuleFilters` struct
- `service/alert_service.go` - Updated `ListRules` signature
- `engine/alert_engine.go` - Updated to use filters

**New files:**
- `handler/alert_rule_handler_test.go` - 13 test cases

---

## Validation

### Local Tests

```bash
# graph-service unit tests
cd services/graph-service && ./mvnw test

# alert-service unit tests  
cd services/alert-service && go test ./internal/handler/...
```

### Remote Validation

After deploying to remote environment:

```bash
source .env.local

# Contract tests
k6 run -e DOCKER_HOST_IP=$DOCKER_HOST_IP -e TEST_ENV=remote \
  tests/api/contracts/graph-service.test.js

k6 run -e DOCKER_HOST_IP=$DOCKER_HOST_IP -e TEST_ENV=remote \
  tests/api/contracts/alert-service.test.js
```

---

## Commits in This Branch

```
81cee8e test(api): revert workarounds, expect correct HTTP status codes
ad630ba test(alert-service): add handler tests for List endpoint filters
74e1f87 test(graph-service): add GraphControllerTest for parameter validation
3651fbc fix(alert-service): implement severity filter in ListRules endpoint
a2b4ab1 fix(graph-service): handle missing address in POST /tags endpoint
13322b3 fix(graph-service): add @Validated for request param validation
4a8083e docs: add Phase 11 fix plan for service bugs and test coverage
```

---

## Next Steps

1. **Deploy** - Rebuild and redeploy `graph-service` and `alert-service` to remote
2. **Verify** - Run contract tests against remote environment
3. **Merge** - Create PR from `fix/phase11-service-fixes` → `main`
4. **CI Enhancement** (future) - Add coverage gates to CI pipeline
