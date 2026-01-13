# Chain Risk Platform - AI Context

> Entry point for AI assistants. Read this first, then task-specific docs.

## Quick Reference

| Item    | Value                             |
| ------- | --------------------------------- |
| Repo    | `tihaya-anon/chain-risk-platform` |
| Version | v0.17.0                           |
| Status  | **Production Ready**              |

**Environment Split:**
- **Local (macOS)**: Development, code editing, local testing
- **Remote (WSL Ubuntu 24.04)**: Docker infrastructure, integration testing

```bash
# Remote access
ssh dev-win "cd ~/chain-risk-platform && make services-up"
```

---

## Architecture

```
External Client → BFF (Gateway/Edge) → Backend Services
                         ↓
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
Query Service (Go)  Graph Service (Java)  Risk ML (Python)
       ↓                 ↓                 ↓
   PostgreSQL          Neo4j           ML Models
                         ↓
       Kafka → Flink (Stream) / Spark (Batch) → Hudi
```

| Service         | Language          | Port | TLS Port | Responsibility                   |
| --------------- | ----------------- | ---- | -------- | -------------------------------- |
| bff             | TypeScript/NestJS | 3001 | 3443     | Gateway, Auth, API Aggregation   |
| query-service   | Go/Gin            | 8081 | 8444     | Address queries                  |
| risk-ml-service | Python/FastAPI    | 8082 | 8445     | ML inference                     |
| alert-service   | Go/Gin            | 8083 | 8446     | Alert rules                      |
| graph-service   | Java/Spring       | 8084 | 8447     | Graph analysis                   |

---

## Project Status

**All Phases Complete** - Platform is production ready.

| Phase | Description | Status |
|-------|-------------|--------|
| 1-11 | Core Platform | ✅ |
| 12 | SRE & Chaos | ✅ |
| 13 | Security Hardening | ✅ |
| 14 | CI/CD Pipeline | ✅ |
| 15 | Performance Testing | ✅ |
| 16 | BFF Consolidation | ✅ |

### Security Matrix

| Service         | TLS | mTLS | Rate Limit | Audit |
| --------------- | --- | ---- | ---------- | ----- |
| bff             | ✅   | ❌*   | ✅          | ✅     |
| query-service   | ✅   | ✅    | ✅          | ✅     |
| risk-ml-service | ✅   | ✅    | ✅          | ✅     |
| alert-service   | ✅   | ✅    | ✅          | ✅     |
| graph-service   | ✅   | ✅    | ✅          | ✅     |

*BFF is edge gateway (external clients don't have certs)

---

## Commands

```bash
# Infrastructure
make infra-up           # Start infra containers
make infra-check        # Verify connectivity

# Services  
make services-up        # Start all services
make <svc>-run          # Run single service

# TLS Mode
docker-compose -f infra/compose/base.yml \
               -f infra/compose/services.yml \
               -f infra/compose/services-tls.yml up -d

# Test
make test-unit          # Unit tests
make test-integration   # Integration tests
./tests/security/tls-suite.sh  # TLS verification
```

---

## Key Documentation

| Topic         | Path                                             |
| ------------- | ------------------------------------------------ |
| Quick Start   | `docs/getting-started/QUICK_START.md`            |
| Architecture  | `docs/architecture/overview/PROJECT_OVERVIEW.md` |
| API Specs     | `docs/api-specs/`                                |
| SLO/SRE       | `docs/sre/SLO_DEFINITIONS.md`                    |
| Roadmap       | `docs/ROADMAP.md`                                |
| Dev SOP       | `docs/operations/runbooks/DEV_SOP.md`            |
| Phase Archive | `docs/archive/phase-docs/`                       |

---

## Git Convention

```bash
# Branch naming
main                          # Production
develop/phase{N}              # Integration
feature/cp{X}-description     # Feature

# Commit format
<type>(<scope>): <description>
# feat(security): add TLS support
# fix(alert): null pointer in handler
```

---

**Updated**: 2026-01-13
