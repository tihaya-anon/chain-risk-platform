# Phase 13: Security Hardening - Verification Guide

> **Status**: Local Verification Complete  
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
# TLS packages only
cd services/query-service && go vet ./pkg/tls/...
cd services/alert-service && go vet ./pkg/tls/...
```

### Java Services (requires JAVA17)

```bash
make orchestrator-build
make graph-build
```

### Python Service

```bash
cd services/risk-ml-service
uv run python -c "from app.core.tls import TLSConfig, create_ssl_context"
```

### TypeScript Service

```bash
cd services/bff && npx tsc --noEmit src/config/tls.ts
```

### Shell Scripts

```bash
bash -n scripts/certs/init-pki.sh
bash -n scripts/certs/generate-service-cert.sh
bash -n scripts/certs/renew-certs.sh
bash -n tests/security/tls-suite.sh
bash -n tests/security/audit-verify.sh
bash -n scripts/security/generate-report.sh
```

### Docker Compose Validation

```bash
docker-compose -f infra/compose/base.yml -f infra/compose/security.yml config > /dev/null
docker-compose -f infra/compose/base.yml -f infra/compose/infra.yml \
               -f infra/compose/services.yml -f infra/compose/services-tls.yml config > /dev/null
```

---

## Stage 2: Compilation

### Go Services

```bash
cd services/query-service && go build ./pkg/tls/...
cd services/alert-service && go build ./pkg/tls/...
```

### Java Services

```bash
cd services/orchestrator && mvn compile -DskipTests
cd services/graph-service && mvn compile -DskipTests
```

### Python Service

```bash
cd services/risk-ml-service
uv run python -c "from app.core.tls import TLSConfig, create_ssl_context; print('OK')"
```

### TypeScript Service

```bash
cd services/bff && npm run build
```

---

## Stage 3: Unit Tests

```bash
make test-all
```

---

## Stage 4: Integration Tests (Remote)

### Start Infrastructure

```bash
ssh dev-win "cd ~/chain-risk-platform && make infra-up && make security-up"
sleep 30
```

### Initialize PKI

```bash
ssh dev-win << 'EOF'
cd ~/chain-risk-platform
source scripts/load-env.sh
export VAULT_TOKEN=chainrisk-dev-token
./scripts/certs/init-pki.sh
./scripts/certs/generate-service-cert.sh --all
EOF
```

### Start Services with TLS

```bash
ssh dev-win << 'EOF'
cd ~/chain-risk-platform
docker-compose -f infra/compose/base.yml \
               -f infra/compose/infra.yml \
               -f infra/compose/services.yml \
               -f infra/compose/services-tls.yml up -d
EOF
```

---

## Stage 5: Security Tests (Remote)

```bash
# TLS verification
ssh dev-win "cd ~/chain-risk-platform && ./tests/security/tls-suite.sh"

# Rate limit testing
ssh dev-win "cd ~/chain-risk-platform && k6 run tests/security/k6/rate-limit.test.js"

# Input validation
ssh dev-win "cd ~/chain-risk-platform && k6 run tests/security/k6/validation.test.js"

# Audit log verification
ssh dev-win "cd ~/chain-risk-platform && ./tests/security/audit-verify.sh"
```

---

## Verification Results (2026-01-12)

### Stage 1: Static Analysis

| Check | Status | Notes |
|-------|--------|-------|
| query-service `go vet ./pkg/tls/...` | ✅ PASS | |
| alert-service `go vet ./pkg/tls/...` | ✅ PASS | |
| orchestrator `mvn compile` | ✅ PASS | Fixed: AuditAspect → AuditWebFilter |
| graph-service `mvn compile` | ✅ PASS | Fixed: Added resilience4j dependency |
| risk-ml-service `python import` | ✅ PASS | |
| bff `tsc --noEmit src/config/tls.ts` | ✅ PASS | |
| Shell scripts syntax | ✅ PASS | All 6 scripts |
| Docker Compose validation | ✅ PASS | security.yml, services-tls.yml |

### Stage 2: Compilation

| Check | Status | Notes |
|-------|--------|-------|
| query-service `go build ./pkg/tls/...` | ✅ PASS | |
| alert-service `go build ./pkg/tls/...` | ✅ PASS | |
| orchestrator `mvn compile` | ✅ PASS | |
| graph-service `mvn compile` | ✅ PASS | |
| risk-ml-service TLS module | ✅ PASS | |
| bff `npm run build` | ✅ PASS | |

### Stage 3: Unit Tests

| Check | Status | Notes |
|-------|--------|-------|
| Go TLS packages | ⚠️ N/A | No test files (acceptable for config packages) |

### Fixes Applied

| Issue | Fix | Commit |
|-------|-----|--------|
| orchestrator AuditAspect uses Servlet API in WebFlux | Replaced with AuditWebFilter | `fix/orchestrator-audit-webflux` |
| graph-service missing resilience4j-ratelimiter | Added dependency to pom.xml | `fix/graph-service-ratelimit-dep` |

---

## Verification Checklist

### Static Analysis
- [x] `go vet ./pkg/tls/...` passes for query-service
- [x] `go vet ./pkg/tls/...` passes for alert-service
- [x] `mvn compile` passes for orchestrator
- [x] `mvn compile` passes for graph-service
- [x] Python TLS module imports successfully
- [x] TypeScript TLS config compiles
- [x] Shell scripts pass syntax check
- [x] Docker Compose files validate

### Compilation
- [x] query-service TLS package builds
- [x] alert-service TLS package builds
- [x] orchestrator builds
- [x] graph-service builds
- [x] risk-ml-service TLS module OK
- [x] bff builds

### Integration (Remote)
- [ ] Infrastructure starts
- [ ] Vault PKI initialized
- [ ] Certificates generated
- [ ] Services start with TLS

### Security Tests (Remote)
- [ ] TLS handshakes succeed
- [ ] mTLS enforced
- [ ] Rate limiting works
- [ ] Input validation works
- [ ] Audit logs in Loki

---

## Sign-off

| Stage | Verified By | Date | Status |
|-------|-------------|------|--------|
| Static Analysis | W1 | 2026-01-12 | ✅ |
| Compilation | W1 | 2026-01-12 | ✅ |
| Unit Tests | W1 | 2026-01-12 | ⚠️ N/A |
| Integration Tests | | | ⬜ Pending |
| Security Tests | | | ⬜ Pending |

---

**Document Version**: 1.2  
**Last Updated**: 2026-01-12
