# Chain Risk Platform - AI Context

> Entry point for AI assistants.

## Quick Reference

| Item | Value |
|------|-------|
| Repo | `tihaya-anon/chain-risk-platform` |
| Version | v0.18.0 |
| Platform | Multi-language Microservices + DevOps/SRE |
| Focus | Backend Architecture, Real-time Processing, K8s |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Multi-language Microservices               │
│  TypeScript (Gateway) │ Go (APIs) │ Python (ML) │ Java  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Message Queue (Kafka) + Cache (Redis)           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│    Stream Processing (Flink) + Batch (Spark)            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Storage: PostgreSQL │ Neo4j │ Data Lake                │
└─────────────────────────────────────────────────────────┘
```

**Key Technical Highlights**:
- Lambda Architecture (batch + stream processing)
- Event-driven with Kafka
- Real-time CEP (Complex Event Processing) with Flink
- Distributed tracing & observability
- Kubernetes deployment with GitOps

## Project Structure

```
services/              # Backend business services
├── bff/               # Gateway (TypeScript)
├── query-service/     # Queries (Go)
├── risk-ml-service/   # ML (Python)
├── alert-service/     # Alerts (Go)
└── graph-service/     # Graph (Java)

data-ingestion/        # On-chain data collection (Go)
mempool-collector/     # Mempool data collection (Go)

processing/            # Data processing
├── stream-processor/  # Flink (Java)
└── batch-processor/   # Spark (Java)

tools/                 # Development tools
└── load-generator/    # Load testing (Go)
```

## Services

| Service | Lang | Port | Key Features |
|---------|------|------|--------------|
| bff | TypeScript/NestJS | 3001 | Gateway, Circuit Breaker, Rate Limiting, WebSocket |
| query-service | Go/Gin | 8081 | RESTful API, PostgreSQL, Redis cache |
| risk-ml-service | Python/FastAPI | 8082 | ML scoring, async processing |
| alert-service | Go/Gin | 8083 | Real-time alerts, Kafka consumer |
| graph-service | Java/Spring | 8084 | Neo4j graph analysis, JPA |
| mempool-collector | Go | 9090 | WebSocket streaming, Kafka producer |

**Tech Stack**:
- **Languages**: TypeScript, Go, Python, Java
- **Frameworks**: NestJS, Gin, FastAPI, Spring Boot
- **Processing**: Flink (stream), Spark (batch)
- **Storage**: PostgreSQL, Redis, Neo4j, Kafka
- **Infra**: Docker, Kubernetes, Helm, ArgoCD

---

## Project Status

| Phase | Focus | Status |
|-------|-------|--------|
| 1-16 | Core Services + Security + CI/CD | ✅ |
| 17 | Observability + SLO/Error Budget | ✅ |
| 18 | Real-time Processing + K8s Migration | ✅ |

**Portfolio Strengths**:
- ✅ Multi-language backend (4 languages, 6 services)
- ✅ DevOps/SRE practices (K8s, GitOps, Observability)
- ✅ Real-time & batch processing (Flink/Spark)
- ✅ Distributed systems patterns
- ⚠️ Domain knowledge (blockchain as use case)

---

## Key Docs

| Topic | Path |
|-------|------|
| Roadmap | `docs/ROADMAP.md` |
| Goals | `PROJECT_GOALS.md` |
| Phase 18 | `docs/development/plans/PHASE18_MEV_K8S.md` |
| K8s/Helm | `infra/k8s/charts/` |
| ArgoCD | `infra/k8s/argocd/` |

---

## Commands

```bash
make infra-up          # Infrastructure
make services-up       # Services
make test-unit         # Tests

# Data collectors
make mempool-build     # Build mempool collector
make mempool-run       # Run mempool collector

# Tools
make loadgen-run       # Run load generator

# K8s deployment
helm install <service> infra/k8s/charts/chain-risk-service -f infra/k8s/charts/values/<service>.yaml
```

---

**Updated**: 2026-01-29
