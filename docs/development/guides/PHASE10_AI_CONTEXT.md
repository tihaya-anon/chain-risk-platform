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
3. **Project Structure**: `docs/README.md`
4. **Quick Start**: `docs/getting-started/QUICK_START.md`

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

### Remote Server (for integration testing)
- Host: Configured via SSH alias `dev-win`
- Services accessible at `100.120.144.128:*`

### Port Mapping (Remote)
| Service | Port |
|---------|------|
| PostgreSQL | 15432 |
| Redis | 16379 |
| Kafka | 19092 |
| Neo4j | 17474, 17687 |
| Nacos | 18848 |
| Prometheus | 19090 |
| Grafana | 13001 |
| Loki | 13100 |
| Jaeger | 26686 |

---

## Code Conventions

- **Go**: Standard project layout, `internal/` for private code
- **Python**: FastAPI, Poetry/uv for deps, loguru for logging
- **Java**: Spring Boot 3, Maven
- **TypeScript**: NestJS (BFF), React (Frontend)
- **Commits**: `feat(cpX):`, `fix(cpX):`, `docs(cpX):`

---

## Communication Protocol

When completing a checkpoint:
1. Merge to `develop/phase10`
2. Notify downstream workers (see Notify column in phase plan)
3. Update checkpoint status in your tracking

When blocked:
1. Check if upstream CP is merged
2. If not, wait or coordinate with upstream owner
3. Do NOT skip dependencies

---

## Useful Commands

```bash
# Sync latest
git checkout develop/phase10 && git pull

# Check what's merged
git log --oneline develop/phase10

# Build all Docker images
make docker-build

# Run integration tests
make test-integration

# Deploy to remote
rsync -avz --exclude='.git' . dev-win:~/chain-risk-platform/
ssh dev-win "cd ~/chain-risk-platform && docker-compose up -d"
```

---

## Questions to Ask Yourself

Before starting a CP:
- [ ] Have all dependency CPs been merged?
- [ ] Do I understand the "Done When" criteria?
- [ ] Have I read the detailed spec in PRODUCTION_HARDENING_PHASE10.md?

Before merging:
- [ ] Does the code work locally?
- [ ] Have I tested on remote (if applicable)?
- [ ] Is the commit message following convention?
- [ ] Have I notified downstream workers?
