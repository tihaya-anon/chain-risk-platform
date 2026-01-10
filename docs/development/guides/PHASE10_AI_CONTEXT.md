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

## ⚠️ Environment Variables - CRITICAL

**DO NOT** manually set environment variables or debug env issues. Use the provided scripts.

### Scripts Architecture

```
scripts/
├── common.sh          # Shared utilities (logging, load_env, etc.)
├── load-env.sh        # Environment variable loader
├── run-*.sh           # Service runners (auto-load env)
```

### How to Load Environment

```bash
# Method 1: Source load-env.sh (sets all env vars)
source scripts/load-env.sh

# Method 2: Use common.sh's load_env function
source scripts/common.sh
load_env

# Method 3: Pass IP directly
source scripts/load-env.sh 100.120.144.128
```

### What load-env.sh Does

1. Reads `DOCKER_HOST_IP` from `.env.local` (or uses argument/localhost)
2. Sets ALL service connection variables based on `DOCKER_HOST_IP`
3. Applies `.env.local` overrides

### Key Environment Variables (Auto-set by scripts)

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_HOST_IP` | From .env.local | Remote Docker host |
| `POSTGRES_HOST` | $DOCKER_HOST_IP | PostgreSQL host |
| `POSTGRES_PORT` | 15432 | PostgreSQL port |
| `REDIS_HOST` | $DOCKER_HOST_IP | Redis host |
| `REDIS_PORT` | 16379 | Redis port |
| `KAFKA_BROKERS` | $DOCKER_HOST_IP:19092 | Kafka brokers |
| `NEO4J_URI` | bolt://$DOCKER_HOST_IP:17687 | Neo4j connection |
| `NACOS_SERVER` | $DOCKER_HOST_IP:18848 | Nacos server |

### .env.local File

Located at project root, gitignored. Contains:
```bash
DOCKER_HOST_IP=100.120.144.128
ETHERSCAN_API_KEY=xxxxx
NACOS_SERVER=100.120.144.128:18848
# ... other overrides
```

### Running Services Correctly

```bash
# ✅ CORRECT - Use run scripts (auto-load env)
./scripts/run-risk-service.sh
./scripts/run-batch-processor.sh archive

# ✅ CORRECT - Source env first, then run manually
source scripts/load-env.sh
cd services/risk-ml-service
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

# ❌ WRONG - Manual env export (incomplete, error-prone)
export POSTGRES_HOST=100.120.144.128  # Don't do this!
```

### Remote Environment

When running on remote server via SSH:
```bash
# Sync code first
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' \
  . dev-win:~/chain-risk-platform/

# Run on remote (env auto-loads from .env.local there too)
ssh dev-win "cd ~/chain-risk-platform && source scripts/load-env.sh && ..."
```

---

## Git Workflow

```bash
# 1. Clone and setup
git clone https://github.com/tihaya-anon/chain-risk-platform.git
cd chain-risk-platform
git checkout develop/phase10
git pull

# 2. Start checkpoint (replace {X} with CP number)
git checkout -b feature/cp{X}-description

# 3. Work on checkpoint...

# 4. Complete checkpoint
git add -A
git commit -m "feat(cp{X}): description"
git checkout develop/phase10
git pull origin develop/phase10
git merge --no-ff feature/cp{X}-description
git push
```

---

## Key Files to Read First

1. **Phase Plan**: `docs/development/guides/PRODUCTION_HARDENING_PHASE10.md`
2. **Dev SOP**: `docs/operations/runbooks/PARALLEL_DEV_SOP.md`
3. **Environment Scripts**: `scripts/load-env.sh`, `scripts/common.sh`
4. **Project Structure**: `docs/README.md`

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

**Rule**: Do not start a CP until all its dependencies are merged to `develop/phase10`.

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

## Development Environment

### Remote Server
- SSH alias: `dev-win`
- IP: `100.120.144.128` (configured in `.env.local`)

### Port Mapping (Remote)

| Service | Port | Variable |
|---------|------|----------|
| PostgreSQL | 15432 | `POSTGRES_PORT` |
| Redis | 16379 | `REDIS_PORT` |
| Kafka | 19092 | `KAFKA_BROKERS` |
| Neo4j Bolt | 17687 | `NEO4J_PORT` |
| Neo4j HTTP | 17474 | - |
| Nacos | 18848 | `NACOS_SERVER` |
| Prometheus | 19090 | - |
| Grafana | 13001 | - |
| Loki | 13100 | - |
| Jaeger UI | 26686 | - |
| Jaeger OTLP | 14317 | - |

---

## Code Conventions

- **Go**: Standard project layout, `internal/` for private code
- **Python**: FastAPI, Poetry/uv for deps, loguru for logging
- **Java**: Spring Boot 3, Maven
- **TypeScript**: NestJS (BFF), React (Frontend)
- **Commits**: `feat(cpX):`, `fix(cpX):`, `docs(cpX):`

---

## Useful Commands

```bash
# Load environment
source scripts/load-env.sh

# Sync to remote
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' \
  --exclude='target' --exclude='__pycache__' \
  . dev-win:~/chain-risk-platform/

# Run batch job
./scripts/run-batch-processor.sh archive

# Build all Docker images
make docker-build

# Deploy to remote
ssh dev-win "cd ~/chain-risk-platform && docker-compose up -d"

# Check service logs
ssh dev-win "docker logs -f query-service"
```

---

## Common Pitfalls to Avoid

1. **Environment Variables**
   - ❌ Don't manually export individual env vars
   - ✅ Use `source scripts/load-env.sh`

2. **Port Conflicts**
   - Remote uses non-standard ports (15432, 16379, etc.)
   - Always use variables, not hardcoded ports

3. **Dependencies**
   - Don't start a CP before dependencies are merged
   - Pull `develop/phase10` before branching

4. **Testing**
   - Test locally first, then on remote
   - Use `scripts/common.sh` utilities for health checks

---

## Communication Protocol

When completing a checkpoint:
1. Merge to `develop/phase10`
2. Notify downstream workers (see Notify column in phase plan)
3. Update checkpoint status

When blocked:
1. Check if upstream CP is merged
2. If not, wait or coordinate with upstream owner
3. Do NOT skip dependencies
