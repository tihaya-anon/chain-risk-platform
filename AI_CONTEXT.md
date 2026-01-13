# Chain Risk Platform - AI Context

> Entry point for AI assistants. Read this first, then task-specific docs.

## Quick Reference

| Item       | Value                             |
| ---------- | --------------------------------- |
| Repo       | `tihaya-anon/chain-risk-platform` |
| Version    | v0.16.0                           |
| Next Phase | Production Readiness              |

**Environment Split:**
- **Local (macOS)**: Development, code editing, local testing
- **Remote (WSL Ubuntu 24.04)**: Docker infrastructure, integration testing

```bash
# Remote access
ssh dev-win "cd ~/chain-risk-platform && make services-up"
```

---

## Architecture

Lambda Architecture for blockchain risk assessment.

```
Frontend (React) → Orchestrator (Java/Spring) → BFF (TypeScript/NestJS)
                                                      ↓
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    ↓                                 ↓                                 ↓
            Query Service (Go)              Graph Service (Java)              Risk ML (Python)
                    ↓                                 ↓                                 ↓
                PostgreSQL                        Neo4j                          ML Models
                                                      ↓
                              Kafka → Flink (Stream) / Spark (Batch) → Hudi
```

| Service         | Language          | Port | TLS Port | Responsibility       |
| --------------- | ----------------- | ---- | -------- | -------------------- |
| orchestrator    | Java/Spring       | 8080 | 8443     | Gateway, Auth        |
| bff             | TypeScript/NestJS | 3001 | 3443     | Aggregation, API     |
| query-service   | Go/Gin            | 8081 | 8444     | Address queries      |
| risk-ml-service | Python/FastAPI    | 8082 | 8445     | ML inference         |
| alert-service   | Go/Gin            | 8083 | 8446     | Alert rules          |
| graph-service   | Java/Spring       | 8084 | 8447     | Graph analysis       |

---

## Security Status

All services fully integrated with security components:

| Service         | TLS | mTLS | Rate Limit | Audit |
| --------------- | --- | ---- | ---------- | ----- |
| orchestrator    | ✅   | ✅    | ✅          | ✅     |
| bff             | ✅   | ❌*   | ✅          | ✅     |
| query-service   | ✅   | ✅    | ✅          | ✅     |
| risk-ml-service | ✅   | ✅    | ✅          | ✅     |
| alert-service   | ✅   | ✅    | ✅          | ✅     |
| graph-service   | ✅   | ✅    | ✅          | ✅     |

*BFF is edge service, no mTLS required for browser clients

---

## Infrastructure (Remote)

| Component  | External Port |
| ---------- | ------------- |
| PostgreSQL | 15432         |
| Redis      | 16379         |
| Kafka      | 19092         |
| Neo4j      | 17687         |
| Grafana    | 13001         |
| Jaeger     | 26686         |
| Nacos      | 18848         |
| BFF        | 3401          |

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

| Topic             | Path                                             |
| ----------------- | ------------------------------------------------ |
| **Current Tasks** | `docs/development/plans/FOLLOWUP_INTEGRATION.md` |
| Quick Start       | `docs/getting-start/QUICK_START.md`              |
| Development SOP   | `docs/operations/runbooks/DEV_SOP.md`            |
| API Specs         | `docs/api-specs/`                                |
| SLO/SRE           | `docs/sre/SLO_DEFINITIONS.md`                    |
| Architecture      | `docs/architecture/overview/PROJECT_OVERVIEW.md` |
| Troubleshooting   | `docs/development/troubleshooting/`              |

---

## Git Convention

```bash
# Branch naming
main                          # Production
develop/phase{N}              # Integration
feature/cp{X}-description     # Feature

# Commit format
<type>(<scope>): <description>
# feat(cp1): add rate limiting
# fix(alert): null pointer in handler
```

---

## Project Status

| Phase       | Status     |
| ----------- | ---------- |
| 1-15        | ✅ Complete |
| 13 Security | ✅ Integrated |

See `CHANGELOG.md` for history, `docs/ROADMAP.md` for backlog.

---

**Updated**: 2026-01-13
