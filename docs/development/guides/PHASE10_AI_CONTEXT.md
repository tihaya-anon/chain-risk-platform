# Phase 10 Development Context

> Copy this entire file as system context for AI workers

---

## Project Overview

**Chain Risk Platform** - Blockchain address risk assessment system

- **Tech Stack**: Go, Python, Java, TypeScript, React
- **Infra**: Docker Compose, Kafka, PostgreSQL, Redis, Neo4j, Flink
- **Observability**: Prometheus, Grafana, Loki, Jaeger

**Repository**: `tihaya-anon/chain-risk-platform`

---

## Current Phase: Phase 10 - Production Hardening

**Branch**: `develop/phase10`

**Goals**:
1. Containerize all application services
2. Security hardening (Vault, JWT, RBAC)
3. Data persistence (Elasticsearch for Jaeger)
4. Real-time features (WebSocket alerts)
5. Operational excellence

---

## Your Assignment

You are **Worker {N}**. Your checkpoints are listed below.

### Track Assignment

| Worker | Track | Checkpoints |
|--------|-------|-------------|
| W1 | Containerization + Operations | CP-1,2,3,14,15,16 |
| W2 | Security | CP-4,5,6,7 |
| W3 | Persistence + Real-time | CP-8,9,10,11,12,13 |

---

## ⚠️ Environment & Commands - USE MAKEFILE

**DO NOT** manually export environment variables. Use `make` commands.

### How It Works

```
Makefile
  └── LOAD_ENV (auto-loads .env.local + scripts/load-env.sh)
        └── scripts/load-env.sh (sets all vars from DOCKER_HOST_IP)
              └── .env.local (DOCKER_HOST_IP, secrets)
```

Makefile 中定义了：
```makefile
LOAD_ENV := set -a && source .env.local && source ./scripts/load-env.sh > /dev/null &&
```

所有 `make xxx` 命令自动加载环境变量。

### Correct Usage

```bash
# ✅ CORRECT - Use make commands
make risk-run           # Run risk service
make flink-run          # Run Flink processor
make batch-archive      # Run batch job
make test-e2e           # Run E2E tests
make infra-up           # Start Docker infrastructure

# ✅ CORRECT - For custom scripts, use LOAD_ENV pattern in Makefile
# Add to Makefile:
my-command:
    @bash -c '$(LOAD_ENV) ./my-script.sh'

# ❌ WRONG - Manual env export
export POSTGRES_HOST=100.120.144.128  # Don't do this!
source scripts/load-env.sh && ./my-script.sh  # Avoid direct script calls
```

### Key Make Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make infra-up` | Start Docker infrastructure |
| `make infra-down` | Stop infrastructure |
| `make infra-check` | Check infrastructure status |
| `make run-svc` | Run all backend services |
| `make run-svc-otel` | Run services with OTel tracing |
| `make stop-svc` | Stop all services |
| `make build-all` | Build all services |
| `make test-all` | Test all services |
| `make test-e2e` | Run E2E test suite |

### Service-Specific Commands

| Service | Build | Run | Test |
|---------|-------|-----|------|
| Query (Go) | `make query-build` | `make query-run` | `make query-test` |
| Risk (Python) | `make risk-build` | `make risk-run` | `make risk-test` |
| Alert (Go) | `make alert-build` | `make alert-run` | `make alert-test` |
| Graph (Java) | `make graph-build` | `make graph-run` | `make graph-test` |
| Orchestrator | `make orchestrator-build` | `make orchestrator-run` | `make orchestrator-test` |
| BFF (TS) | `make bff-build` | `make bff-run` | `make bff-test` |
| Flink | `make flink-build` | `make flink-run` | `make flink-test` |
| Batch | `make batch-build` | `make batch-archive` | `make batch-test` |

### Adding New Commands

When adding new functionality, follow this pattern:

```makefile
# In Makefile
my-new-service-run:
    @bash -c '$(LOAD_ENV) cd $(DIR_MY_SERVICE) && ./run.sh'

my-new-script:
    @bash -c '$(LOAD_ENV) ./scripts/my-script.sh'
```

### .env.local File

Located at project root (gitignored):
```bash
DOCKER_HOST_IP=100.120.144.128
ETHERSCAN_API_KEY=xxxxx
NACOS_SERVER=100.120.144.128:18848
```

### Remote Execution

```bash
# Sync code to remote (use git instead for large changes)
git push origin main
ssh dev-win "cd ~/chain-risk-platform && git pull origin main"

# Run make commands on remote
ssh dev-win "cd ~/chain-risk-platform && make infra-check"
ssh dev-win "cd ~/chain-risk-platform && make risk-run"
```

---

## Git Workflow

```bash
# 1. Clone and setup
git clone https://github.com/tihaya-anon/chain-risk-platform.git
cd chain-risk-platform
git checkout develop/phase10
git pull

# 2. Start checkpoint
git checkout -b feature/cp{X}-description

# 3. Work... use make commands

# 4. Complete checkpoint
git add -A
git commit -m "feat(cp{X}): description"
git checkout develop/phase10
git pull origin develop/phase10
git merge --no-ff feature/cp{X}-description
git push
```

---

## Key Files

| File | Purpose |
|------|---------|
| `Makefile` | All commands, auto-loads env |
| `.env.local` | Local secrets (gitignored) |
| `scripts/load-env.sh` | Environment variable definitions |
| `scripts/common.sh` | Shared utilities |
| `docker-compose.yml` | Infrastructure services |

---

## Port Reference (Remote)

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 15432 | - |
| Redis | 16379 | - |
| Kafka | 19092 | - |
| Neo4j | 17687 | - |
| Nacos | 18848 | - |
| Prometheus | 19090 | - |
| Grafana | 13001 | - |
| Loki | 13100 | - |
| Jaeger | 26686 | - |
| Elasticsearch | 19200 | - |
| Query Service | 8081 | - |
| Risk Service | 8082 | - |
| Alert Service | 8083 | - |
| Graph Service | 8084 | - |
| Orchestrator | 8080 | - |
| BFF | 3401 | Changed from 3001 due to Windows Hyper-V port exclusion |

---

## Common Pitfalls

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `export POSTGRES_HOST=...` | `make xxx` (auto-loads) |
| `source scripts/load-env.sh && ...` | Add to Makefile with `$(LOAD_ENV)` |
| Hardcode port `15432` | Use `${POSTGRES_PORT}` in scripts |
| Skip CP dependency | Wait for upstream merge |
| Use rsync for code sync | Use `git push` + `git pull` |

---

## Code Conventions

- **Go**: Standard layout, `internal/` for private
- **Python**: FastAPI, uv, loguru
- **Java**: Spring Boot 3, Maven
- **TypeScript**: NestJS (BFF), React (Frontend)
- **Commits**: `feat(cpX):`, `fix(cpX):`, `docs(cpX):`
