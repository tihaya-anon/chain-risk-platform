# Chain Risk Platform - AI Context

> Entry point for AI assistants. Read this first, then task-specific docs.

## Quick Reference

| Item    | Value                             |
| ------- | --------------------------------- |
| Repo    | `tihaya-anon/chain-risk-platform` |
| Version | v0.18.0                           |
| Status  | **Production Ready**              |

**Environment Split:**
- **Local (macOS)**: Development, code editing, local testing
- **Remote (WSL Ubuntu 24.04)**: Docker infrastructure, integration testing

```bash
ssh dev-win "cd ~/chain-risk-platform && make services-up"
```

---

## Architecture

```
Frontend → BFF (Gateway/Edge) → Backend Services
                 ↓
   ┌─────────────┼─────────────┐
   ↓             ↓             ↓
Query (Go)   Graph (Java)   Risk ML (Python)
   ↓             ↓             ↓
PostgreSQL     Neo4j       ML Models
```

| Service         | Language          | Port | Responsibility                 |
| --------------- | ----------------- | ---- | ------------------------------ |
| bff             | TypeScript/NestJS | 3001 | Gateway, Auth, Orchestration   |
| query-service   | Go/Gin            | 8081 | Address queries                |
| risk-ml-service | Python/FastAPI    | 8082 | ML inference                   |
| alert-service   | Go/Gin            | 8083 | Alert rules                    |
| graph-service   | Java/Spring       | 8084 | Graph analysis                 |
| load-generator  | Go                | 9100 | Load testing (Phase 17)        |

---

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1-11 | Core Platform | ✅ |
| 12 | Observability & SRE | ✅ |
| 13 | Security Hardening | ✅ |
| 14 | CI/CD Pipeline | ✅ |
| 15 | Performance Testing | ✅ |
| 16 | BFF Consolidation | ✅ |
| 17 | AIOps Foundation | ✅ |

### Phase 17 Deliverables

| Component | Description |
|-----------|-------------|
| OTel Data Lake | Kafka → Spark → Hudi archival |
| USE Metrics | Utilization/Saturation/Errors |
| Load Generator | Multi-pattern load testing |
| Capacity Modeling | Little's Law, USL fitting |
| SLO Automation | Error budget, burn rate alerts |
| Structured Logging | JSON + trace correlation |

---

## Commands

```bash
make infra-up           # Start infra
make services-up        # Start services
make test-unit          # Unit tests
make test-integration   # Integration tests
```

---

## Key Documentation

| Topic         | Path                                  |
| ------------- | ------------------------------------- |
| Architecture  | `docs/architecture/`                  |
| API Specs     | `docs/api-specs/`                     |
| SRE           | `docs/sre/`                           |
| Phase 17      | `docs/development/plans/PHASE17_AIOPS_FOUNDATION.md` |

---

## Git Convention

```bash
# Branch: main, develop/phase{N}, feature/cp{X}-desc
# Commit: <type>(<scope>): <description>
```

---

**Updated**: 2026-01-14
