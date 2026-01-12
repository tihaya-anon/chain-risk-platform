# Phase 13: Security Hardening - Verification Guide

> **Status**: Development Complete → Verification  
> **Version**: v0.13.0-rc

---

## Overview

| Stage | Type | Environment | Tools |
|-------|------|-------------|-------|
| 1 | Static Analysis | Local | go vet, ruff, eslint, mvn checkstyle |
| 2 | Compilation | Local | go build, mvn compile, npm build, uv |
| 3 | Unit Tests | Local | go test, pytest, jest, mvn test |
| 4 | Integration Tests | Remote (dev-win) | docker-compose, make |
| 5 | Security Tests | Remote (dev-win) | k6, curl, openssl |

---

## Environment Setup

### Remote Environment (dev-win)

```bash
# Verify SSH access
ssh dev-win "echo 'Connection OK'"

# Key ports (external mapping)
# PostgreSQL: 15432    Redis: 16379      Kafka: 19092
# Vault: 18200         Nacos: 18848      Loki: 13100
# Grafana: 13001       BFF: 3401
```

### Environment Variables

The project uses `scripts/load-env.sh` which reads from `.env.local`:

```bash
# Key variables for TLS testing
DOCKER_HOST_IP=<dev-win-ip>
VAULT_ADDR=http://${DOCKER_HOST_IP}:18200
```

---

## Stage 1: Static Analysis

### Go Services

```bash
# Using Makefile
make query-test   # includes go vet
make alert-test   # includes go vet

# Or manually
cd services/query-service && go vet ./...
cd services/alert-service && go vet ./...
```

### Java Services (requires JAVA17)

```bash
# Makefile uses JAVA17_HOME
make orchestrator-test
make graph-test

# Or manually (ensure JAVA_HOME is set)
cd services/orchestrator && mvn checkstyle:check
cd services/graph-service && mvn checkstyle:check
```

### Python Service

```bash
# Using uv (project default)
cd services/risk-ml-service
uv run ruff check app/
uv run mypy app/core/tls.py
```

### TypeScript Service

```bash
make bff-test

# Or manually
cd services/bff && npm run lint
```

### Shell Scripts

```bash
# Syntax check
bash -n scripts/certs/init-pki.sh
bash -n scripts/certs/generate-service-cert.sh
bash -n scripts/certs/renew-certs.sh
bash -n tests/security/tls-suite.sh
bash -n tests/security/audit-verify.sh
bash -n scripts/security/generate-report.sh
```

### Docker Compose Validation

```bash
# Validate compose files (requires base.yml for networks)
docker-compose -f infra/compose/base.yml -f infra/compose/security.yml config > /dev/null
docker-compose -f infra/compose/base.yml -f infra/compose/infra.yml \
               -f infra/compose/services.yml -f infra/compose/services-tls.yml config > /dev/null
```

---

## Stage 2: Compilation

### Go Services

```bash
make query-build
make alert-build

# Verify TLS package specifically
cd services/query-service && go build ./pkg/tls/...
cd services/alert-service && go build ./pkg/tls/...
```

### Java Services

```bash
make orchestrator-build
make graph-build
```

### Python Service

```bash
make risk-build  # runs uv sync

# Verify TLS module
cd services/risk-ml-service
uv run python -c "from app.core.tls import TLSConfig, create_ssl_context; print('OK')"
```

### TypeScript Service

```bash
make bff-build
```

### Docker Images

```bash
make docker-build
```

---

## Stage 3: Unit Tests

```bash
# All services
make test-all

# Individual
make query-test      # Go: go test ./...
make alert-test      # Go: go test ./...
make risk-test       # Python: uv run pytest
make bff-test        # TypeScript: npm test
make orchestrator-test  # Java: mvn test
make graph-test      # Java: mvn test
```

---

## Stage 4: Integration Tests (Remote)

### Start Infrastructure

```bash
# SSH to dev-win
ssh dev-win

# Start core infrastructure
cd ~/chain-risk-platform
make infra-up

# Start security (Vault)
make security-up

# Wait for services
sleep 30
```

### Initialize PKI

```bash
# On dev-win, source environment
source scripts/load-env.sh

# Check Vault status
curl -s ${VAULT_ADDR}/v1/sys/health | jq .

# Initialize PKI (first time only)
export VAULT_TOKEN=chainrisk-dev-token
./scripts/certs/init-pki.sh

# Generate all service certificates
./scripts/certs/generate-service-cert.sh --all
```

### Start Services

```bash
# Standard mode (no TLS)
make services-up

# With TLS overlay (after certificates generated)
docker-compose -f infra/compose/base.yml \
               -f infra/compose/infra.yml \
               -f infra/compose/services.yml \
               -f infra/compose/services-tls.yml up -d
```

### Verify Services

```bash
# Check running containers
make services-ps

# Health checks (HTTP mode)
curl -s http://localhost:8081/health  # query-service
curl -s http://localhost:8082/health  # risk-ml-service
curl -s http://localhost:8083/health  # alert-service
curl -s http://localhost:8084/actuator/health  # graph-service
curl -s http://localhost:8080/actuator/health  # orchestrator
curl -s http://localhost:3001/health  # bff
```

---

## Stage 5: Security Tests (Remote)

### 5.1 TLS Verification

```bash
# Run TLS test suite
./tests/security/tls-suite.sh

# Manual TLS handshake test
openssl s_client -connect localhost:8444 </dev/null 2>/dev/null | grep "Verify return code"

# mTLS test (without client cert - should fail)
curl -s -o /dev/null -w "%{http_code}" --insecure https://localhost:8444/health
# Expected: 000 or 403

# mTLS test (with client cert - should succeed)
curl -s --cert infra/certs/client/cert.pem \
        --key infra/certs/client/key.pem \
        --cacert infra/certs/ca-chain.pem \
        https://localhost:8444/health
```

### 5.2 Rate Limit Testing

```bash
# Using k6
k6 run tests/security/k6/rate-limit.test.js

# Using shell script
./tests/security/rate-limit-test.sh
```

### 5.3 Input Validation Testing

```bash
# Using k6
k6 run tests/security/k6/validation.test.js

# Manual test - invalid address
curl -s http://localhost:8081/api/v1/addresses/invalid
# Expected: 400

# Manual test - SQL injection
curl -s "http://localhost:8081/api/v1/addresses/'; DROP TABLE--"
# Expected: 400
```

### 5.4 Audit Log Verification

```bash
# Verify audit logs in Loki
export LOKI_URL=http://localhost:3100
./tests/security/audit-verify.sh

# Manual Loki query
curl -s -G "${LOKI_URL}/loki/api/v1/query" \
    --data-urlencode 'query={job="chainrisk"} |= "AUDIT"' | jq .
```

### 5.5 Security Scan

```bash
./tests/security/scan-verify.sh
```

### 5.6 Generate Compliance Report

```bash
./scripts/security/generate-report.sh
# Output: docs/security/reports/security-report-YYYYMMDD.md
```

---

## Verification Results (2026-01-12)

### Stage 1: Static Analysis

| Check | Status | Notes |
|-------|--------|-------|
| query-service `go vet ./pkg/tls/...` | ✅ PASS | |
| alert-service `go vet ./pkg/tls/...` | ✅ PASS | |
| query-service `go vet ./...` | ⚠️ SKIP | Pre-existing: missing `github.com/sony/gobreaker` |
| alert-service `go vet ./...` | ⚠️ SKIP | Pre-existing: missing `github.com/sony/gobreaker` |
| orchestrator `mvn compile` | ❌ FAIL | Missing imports in `AuditAspect.java` (W2 issue) |
| graph-service `mvn compile` | ❌ FAIL | Missing `resilience4j-ratelimiter` dependency (W2 issue) |
| risk-ml-service `python import` | ✅ PASS | TLS module imports OK |
| bff `tsc --noEmit src/config/tls.ts` | ✅ PASS | |
| bff `tsc --noEmit` (full) | ⚠️ SKIP | Pre-existing: test mock issues |
| Shell scripts syntax | ✅ PASS | All 6 scripts pass `bash -n` |
| Docker Compose validation | ✅ PASS | security.yml, services-tls.yml valid |

### Stage 2: Compilation

| Check | Status | Notes |
|-------|--------|-------|
| query-service `go build ./pkg/tls/...` | ✅ PASS | |
| alert-service `go build ./pkg/tls/...` | ✅ PASS | |
| bff `npm run build` | ✅ PASS | |
| risk-ml-service TLS module | ✅ PASS | |
| orchestrator | ❌ FAIL | Same as Stage 1 |
| graph-service | ❌ FAIL | Same as Stage 1 |

### Stage 3: Unit Tests

| Check | Status | Notes |
|-------|--------|-------|
| query-service TLS | ⚠️ N/A | No test files in pkg/tls |
| alert-service TLS | ⚠️ N/A | No test files in pkg/tls |

### Issues Summary

**W1 (Infrastructure Track) - All Pass:**
- CP1: Certificate Management scripts ✅
- CP2: TLS packages (Go, Python, TypeScript) ✅
- CP6: Security test scripts, Docker Compose ✅

**W2/W3 Issues (Not W1 scope):**
1. `orchestrator/AuditAspect.java` - Missing `HttpServletRequest`, `@Around` imports
2. `graph-service/RateLimitConfig.java` - Missing `resilience4j-ratelimiter` dependency

---

## Verification Checklist

### Static Analysis
- [x] `go vet ./pkg/tls/...` passes for query-service
- [x] `go vet ./pkg/tls/...` passes for alert-service
- [ ] `mvn compile` passes for orchestrator (W2 issue)
- [ ] `mvn compile` passes for graph-service (W2 issue)
- [x] Python TLS module imports successfully
- [x] TypeScript TLS config compiles
- [x] Shell scripts pass syntax check
- [x] Docker Compose files validate

### Compilation
- [x] query-service TLS package builds
- [x] alert-service TLS package builds
- [ ] orchestrator builds (W2 issue)
- [ ] graph-service builds (W2 issue)
- [x] risk-ml-service TLS module OK
- [x] bff builds

### Unit Tests
- [ ] TLS package tests (no test files yet)

### Integration (Remote)
- [ ] Not yet executed

### Security Tests (Remote)
- [ ] Not yet executed

---

## Troubleshooting

### Java Build Fails

```bash
# Ensure JAVA17 is available
/usr/libexec/java_home -v 17

# Makefile sets JAVA17_HOME automatically
make orchestrator-build
```

### Python Module Import Error

```bash
# Use uv (project default) instead of system python
cd services/risk-ml-service
uv run python -c "from app.core.tls import TLSConfig"
```

### TLS Handshake Fails

```bash
# Check certificate
openssl x509 -in infra/certs/query-service/cert.pem -noout -text

# Check chain
openssl verify -CAfile infra/certs/ca-chain.pem infra/certs/query-service/cert.pem

# Check service logs
docker logs query-service 2>&1 | grep -i tls
```

### Vault Connection Failed

```bash
# Check Vault status
source scripts/load-env.sh
curl -s ${VAULT_ADDR}/v1/sys/health

# If sealed, unseal
make vault-unseal
```

---

## Quick Commands

```bash
# Local validation (all stages 1-3)
make build-all
make test-all

# Remote full stack
ssh dev-win "cd ~/chain-risk-platform && make up-all"

# Security tests
ssh dev-win "cd ~/chain-risk-platform && ./tests/security/tls-suite.sh"
```

---

## Sign-off

| Stage | Verified By | Date | Status |
|-------|-------------|------|--------|
| Static Analysis | W1 | 2026-01-12 | ✅ (W1 scope) |
| Compilation | W1 | 2026-01-12 | ✅ (W1 scope) |
| Unit Tests | W1 | 2026-01-12 | ⚠️ No test files |
| Integration Tests | | | ⬜ |
| Security Tests | | | ⬜ |

---

**Document Version**: 1.1  
**Last Updated**: 2026-01-12
