# Chain Risk Platform - AI Context

---

## Project

Blockchain address risk assessment system using Lambda Architecture.

| Stack | Technologies |
|-------|--------------|
| Backend | Go (Gin), Java (Spring Boot), Python (FastAPI), TypeScript (NestJS) |
| Data | Kafka, Flink, Spark, Hudi, PostgreSQL, Redis, Neo4j |
| Observability | Prometheus, Grafana, Loki, Jaeger |
| Infra | Docker Compose, Nacos, Vault |

**Repo**: `tihaya-anon/chain-risk-platform`

---

## Services

| Service | Lang | Port |
|---------|------|------|
| orchestrator | Java | 8080 |
| bff | TypeScript | 3001 |
| query-service | Go | 8081 |
| risk-ml-service | Python | 8082 |
| alert-service | Go | 8083 |
| graph-service | Java | 8084 |

---

## Current Status

| Phase | Status | Content |
|-------|--------|---------|
| 1-15 | ✅ | Core platform, SRE, CI/CD, Performance |
| 13 | 📋 | Security Hardening (next) |

**Next**: Phase 13 - Security Hardening

---

## Remote Environment

```bash
ssh dev-win "cd ~/chain-risk-platform && make services-up"
```

| Service | External Port |
|---------|---------------|
| PostgreSQL | 15432 |
| Redis | 16379 |
| Kafka | 19092 |
| Grafana | 13001 |
| BFF | 3401 |

---

## Commands

```bash
make infra-up          # Start infrastructure
make services-up       # Start all services
make test-all          # Run tests
make docker-build      # Build images
```

---

## Key Docs

| Doc | Path |
|-----|------|
| Roadmap | `docs/ROADMAP.md` |
| Phase 13 Plan | `docs/development/plans/PHASE13_SECURITY.md` |
| SLO Definitions | `docs/sre/SLO_DEFINITIONS.md` |
| Performance | `docs/performance/BASELINE_REPORT.md` |

---

**Version**: v0.15.0 | **Updated**: 2026-01-12
