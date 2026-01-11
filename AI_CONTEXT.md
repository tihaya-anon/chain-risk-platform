# Chain Risk Platform - AI Development Context

> **Usage**: Provide this file as system context when starting a new AI session.

---

## Project Summary

**Chain Risk Platform** - Blockchain address risk assessment system using Lambda Architecture.

| Stack | Technologies |
|-------|--------------|
| Backend | Go (Gin), Java (Spring Boot), Python (FastAPI), TypeScript (NestJS) |
| Data | Kafka, Flink, Spark, Hudi, PostgreSQL, Redis, Neo4j |
| Observability | Prometheus, Grafana, Loki, Jaeger, OpenTelemetry |
| Infra | Docker Compose, Nacos (service discovery) |

**Repository**: `tihaya-anon/chain-risk-platform`

---

## Architecture

```
Frontend (React) → BFF (NestJS) → Orchestrator (Spring Gateway)
                                         ↓
           ┌─────────────┬───────────────┼───────────────┬─────────────┐
           ↓             ↓               ↓               ↓             ↓
    Query Service   Alert Service   Risk-ML Service   Graph Service   ...
         (Go)           (Go)           (Python)         (Java)
           ↓             ↓               ↓               ↓
    PostgreSQL ←── Kafka ──→ Flink ──→ Neo4j
         ↓
    Hudi (archive)
```

---

## Services

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| orchestrator | Java | 8080 | API Gateway, JWT, routing |
| bff | TypeScript | 3001 (internal) | Business aggregation |
| query-service | Go | 8081 | Address/transaction queries |
| risk-ml-service | Python | 8082 | ML risk scoring |
| alert-service | Go | 8083 | Alert rules & notifications |
| graph-service | Java | 8084 | Neo4j graph analysis |

---

## Development Commands

All commands use `make`. Environment variables are auto-loaded.

```bash
# Infrastructure
make infra-up           # Start all infra (postgres, redis, kafka, etc.)
make infra-down         # Stop infrastructure
make monitoring-up      # Start observability stack
make services-up        # Start application services (Docker)

# Local development (run services locally, connect to remote infra)
make query-run          # Run query-service
make risk-run           # Run risk-ml-service
make alert-run          # Run alert-service
make graph-run          # Run graph-service
make orchestrator-run   # Run orchestrator
make bff-run            # Run BFF

# Build & Test
make build-all          # Build all services
make test-all           # Test all services
make test-e2e           # E2E tests

# Docker
make docker-build       # Build all Docker images
make docker-up          # Start all in Docker
make docker-down        # Stop all
```

---

## Remote Development Environment

Development runs on a remote Windows machine with WSL2/Docker.

```bash
# SSH alias configured as 'dev-win'
ssh dev-win "cd ~/chain-risk-platform && make infra-up"
ssh dev-win "cd ~/chain-risk-platform && docker ps"

# Sync code changes
git push origin main
ssh dev-win "cd ~/chain-risk-platform && git pull origin main"
```

### External Ports (accessible from dev machine)

| Service | Port |
|---------|------|
| PostgreSQL | 15432 |
| Redis | 16379 |
| Kafka | 19092 |
| Neo4j | 17687 |
| Nacos | 18848 |
| Prometheus | 19090 |
| Grafana | 13001 |
| Jaeger UI | 26686 |
| Elasticsearch | 19200 |
| BFF | 3401 |

---

## Project Structure

```
chain-risk-platform/
├── services/              # Application services
│   ├── orchestrator/      # Java Spring Gateway
│   ├── bff/               # TypeScript NestJS
│   ├── query-service/     # Go
│   ├── risk-ml-service/   # Python FastAPI
│   ├── alert-service/     # Go
│   └── graph-service/     # Java Spring Boot
├── processing/            # Data processing
│   ├── stream-processor/  # Flink (Java)
│   └── batch-processor/   # Spark (Java)
├── data-ingestion/        # Go - Kafka producer
├── ml-training/           # Python - ML pipeline
├── frontend/              # React
├── infra/                 # Docker Compose, configs
│   ├── compose/           # Modular compose files
│   ├── prometheus/        # Prometheus config
│   └── grafana/           # Dashboards
├── scripts/               # Utility scripts
├── tests/                 # E2E tests
└── docs/                  # Documentation
```

---

## Key Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Roadmap | `docs/ROADMAP.md` | Future plans |
| Architecture | `docs/architecture/overview/PROJECT_OVERVIEW.md` | System design |
| API Specs | `docs/api-specs/openapi/*.json` | OpenAPI definitions |
| Deployment | `docs/operations/runbooks/DOCKER_DEPLOYMENT.md` | Docker guide |
| Parallel Dev SOP | `docs/operations/runbooks/PARALLEL_DEV_SOP.md` | Multi-worker workflow |

---

## Git Workflow

```bash
# Feature development
git checkout main
git pull origin main
git checkout -b feature/description

# ... make changes ...

git add -A
git commit -m "feat: description"
git push origin feature/description
# Create PR or merge to main
```

**Commit Convention**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

---

## Current Status

**Version**: v0.10.6

**Completed Phases**: 1-10.5 (Foundation → Production Hardening → Observability)

**Next Options**:
- Phase 11: Performance Testing (k6/Locust, SLA baselines)
- Phase 12: Security Hardening (TLS, rate limiting)
- Phase 13: CI/CD Pipeline (GitHub Actions)

See `docs/ROADMAP.md` for details.

---

## Quick Start for New Tasks

1. **Understand the task** - Check related docs if needed
2. **Create branch** - `git checkout -b feature/task-name`
3. **Make changes** - Follow existing code patterns
4. **Test locally** - `make xxx-test` or `make test-e2e`
5. **Deploy to remote** - `git push` then `ssh dev-win "cd ~/chain-risk-platform && git pull && make services-up"`
6. **Verify** - Check logs, health endpoints, Grafana dashboards
7. **Commit & merge** - Follow git workflow

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Service can't connect to DB | Check Docker network, use service names not localhost |
| Port already in use | Check Windows Hyper-V exclusions: `netsh interface ipv4 show excludedportrange protocol=tcp` |
| Kafka cluster ID mismatch | Clear volumes: `docker volume rm chainrisk_kafka_data` |
| SSH connection reset | Wait for WSL to restart, retry after 30s |

---

**Last Updated**: 2026-01-11
