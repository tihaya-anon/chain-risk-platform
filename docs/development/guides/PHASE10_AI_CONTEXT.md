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
# Sync code to remote
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' \
  --exclude='target' --exclude='__pycache__' \
  . dev-win:~/chain-risk-platform/

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

## Checkpoint Dependency DAG

```
[CP-1]──────────────[CP-4]──────────────[CP-8]──────────────[CP-11]
   │                  │ │                  │                    │
   ▼                  ▼ ▼                  ▼                    ▼
[CP-2]────────▶[CP-5][CP-6]          [CP-9]              [CP-12]
   │                │   │                │                    │
   ▼                └─┬─┘                ▼                    ▼
[CP-3]              [CP-7]          [CP-10]              [CP-13]
   │                  │                │                    │
   ▼                  │                │                    │
[CP-14]               │                │                    │
   │                  │                │                    │
   └──────────────────┴────────────────┴────────────────────┘
                      │
                      ▼
                  [CP-15]
                      │
                      ▼
                  [CP-16]
```

**Rule**: Do not start a CP until all dependencies are merged to `develop/phase10`.

---

## Checkpoint Quick Reference

| CP | Task | Owner | Depends | Done When |
|----|------|-------|---------|-----------|
| 1 | Service Dockerfiles | W1 | - | `make docker-build` succeeds |
| 2 | Docker Compose Services | W1 | 1 | `docker-compose up -d` starts all |
| 3 | Service Network Config | W1 | 2 | Services communicate via DNS |
| 4 | Vault Deployment | W2 | - | Vault UI at :18200 |
| 5 | Vault Secret Migration | W2 | 4 | No plain-text secrets |
| 6 | JWT Enhancement | W2 | 4 | Token refresh works |
| 7 | RBAC Implementation | W2 | 5,6 | 403 on unauthorized |
| 8 | Elasticsearch Deployment | W3 | - | ES health green/yellow |
| 9 | Jaeger ES Backend | W3 | 8 | Traces persist after restart |
| 10 | Trace Retention Policy | W3 | 9 | ILM policy applied |
| 11 | WebSocket Gateway | W3 | - | WS connects at /alerts |
| 12 | Alert Push Service | W3 | 11 | Alerts in WS within 1s |
| 13 | Frontend WS Integration | W3 | 12 | Toast notifications work |
| 14 | Health Check Enhancement | W1 | 2 | K8s probes work |
| 15 | Integration Validation | W1 | 3,7,10,13,14 | All checks pass |
| 16 | Documentation Update | W1 | 15 | Docs complete |

---

## Port Reference (Remote)

| Service | Port | Make Command |
|---------|------|--------------|
| PostgreSQL | 15432 | - |
| Redis | 16379 | - |
| Kafka | 19092 | - |
| Neo4j | 17687 | - |
| Nacos | 18848 | - |
| Prometheus | 19090 | - |
| Grafana | 13001 | - |
| Loki | 13100 | - |
| Jaeger | 26686 | - |
| Query Service | 8081 | `make query-run` |
| Risk Service | 8082 | `make risk-run` |
| Alert Service | 8083 | `make alert-run` |
| Graph Service | 8084 | `make graph-run` |
| Orchestrator | 8080 | `make orchestrator-run` |
| BFF | 3001 | `make bff-run` |

---

## Common Pitfalls

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `export POSTGRES_HOST=...` | `make xxx` (auto-loads) |
| `source scripts/load-env.sh && ...` | Add to Makefile with `$(LOAD_ENV)` |
| Hardcode port `15432` | Use `${POSTGRES_PORT}` in scripts |
| Skip CP dependency | Wait for upstream merge |

---

## Code Conventions

- **Go**: Standard layout, `internal/` for private
- **Python**: FastAPI, uv, loguru
- **Java**: Spring Boot 3, Maven
- **TypeScript**: NestJS (BFF), React (Frontend)
- **Commits**: `feat(cpX):`, `fix(cpX):`, `docs(cpX):`
