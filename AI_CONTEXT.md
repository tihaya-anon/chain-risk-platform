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

## Current Phase: 12-15 (Parallel)

**Branch**: `develop/phase12-15`

| Worker | Phase | Role | Doc |
|--------|-------|------|-----|
| A | 12 | SRE & Chaos | `WORKER_A_SRE.md` |
| B | 14 | CI/CD | `WORKER_B_CICD.md` |
| C | 15 | Performance | `WORKER_C_PERF.md` |

**Plan Location**: `docs/development/plans/phase12-15/`

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

## Git Workflow

```bash
git checkout develop/phase12-15
git checkout -b feature/xxx
# work...
git commit -m "feat(XX): description"
git checkout develop/phase12-15
git merge feature/xxx
git push
```

---

## Key Docs

| Doc | Path |
|-----|------|
| Roadmap | `docs/ROADMAP.md` |
| Phase Plan | `docs/development/plans/phase12-15/OVERVIEW.md` |
| Agent Guide | `docs/development/plans/phase12-15/AGENT_STARTUP.md` |

---

**Version**: v0.11.0 | **Updated**: 2026-01-12
