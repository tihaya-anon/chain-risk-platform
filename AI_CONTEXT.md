# Chain Risk Platform - AI Development Context

> Provide this file as context when starting a new AI session.

---

## Project Summary

**Chain Risk Platform** - Blockchain address risk assessment system using Lambda Architecture.

| Stack | Technologies |
|-------|--------------|
| Backend | Go (Gin), Java (Spring Boot), Python (FastAPI), TypeScript (NestJS) |
| Data | Kafka, Flink, Spark, Hudi, PostgreSQL, Redis, Neo4j |
| Observability | Prometheus, Grafana, Loki, Jaeger, OpenTelemetry |
| Infra | Docker Compose, Nacos, Vault |

**Repository**: `tihaya-anon/chain-risk-platform`

### Project Goals

1. **Web3 Domain**: Blockchain data processing, compliance, risk detection
2. **Backend Skills**: Multi-language microservices for freelance work
3. **SRE Skills**: Reliability engineering, chaos testing, incident response

---

## Architecture

```
Frontend → BFF (NestJS) → Orchestrator (Spring Gateway)
                                ↓
          ┌────────┬────────────┼────────────┬────────┐
          ↓        ↓            ↓            ↓        ↓
    Query Svc  Alert Svc  Risk-ML Svc  Graph Svc   ...
       (Go)      (Go)      (Python)     (Java)
          ↓        ↓            ↓            ↓
    PostgreSQL ←── Kafka ──→ Flink ──→ Neo4j
          ↓
    Hudi (archive)
```

---

## Services

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| orchestrator | Java | 8080 | API Gateway, JWT |
| bff | TypeScript | 3001 | Business aggregation |
| query-service | Go | 8081 | Address/transaction queries |
| risk-ml-service | Python | 8082 | ML risk scoring |
| alert-service | Go | 8083 | Alert rules & notifications |
| graph-service | Java | 8084 | Neo4j graph analysis |

---

## Development Commands

```bash
# Infrastructure
make infra-up / infra-down
make monitoring-up
make services-up

# Local dev
make query-run / risk-run / alert-run / graph-run

# Build & Test
make build-all / test-all / test-e2e
make docker-build / docker-up
```

---

## Remote Dev Environment

```bash
# SSH to dev machine
ssh dev-win "cd ~/chain-risk-platform && make infra-up"

# Sync code
git push origin main
ssh dev-win "cd ~/chain-risk-platform && git pull"
```

### External Ports

| Service | Port |
|---------|------|
| PostgreSQL | 15432 |
| Redis | 16379 |
| Kafka | 19092 |
| Neo4j | 17687 |
| Prometheus | 19090 |
| Grafana | 13001 |
| BFF | 3401 |

---

## Current Status

**Version**: v0.11.0

**Completed**: Phase 1-11 (Foundation → Observability → API Testing)

**Next**: Phase 12 - SRE & Chaos Engineering
- SLO/SLI definitions
- Chaos testing (Toxiproxy)
- Fault injection scenarios
- Auto-recovery mechanisms
- On-call runbooks

See `docs/ROADMAP.md` for full roadmap.

---

## Key Documentation

| Document | Path |
|----------|------|
| Roadmap | `docs/ROADMAP.md` |
| Architecture | `docs/architecture/overview/PROJECT_OVERVIEW.md` |
| API Specs | `docs/api-specs/openapi/*.json` |
| Deployment | `docs/operations/runbooks/DOCKER_DEPLOYMENT.md` |

---

## Git Workflow

```bash
git checkout main && git pull
git checkout -b feature/description
# ... changes ...
git commit -m "feat: description"
git push origin feature/description
```

**Commit Convention**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

---

**Last Updated**: 2026-01-12
