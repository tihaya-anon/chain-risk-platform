# Chain Risk Platform

> Multi-language microservices platform with Lambda Architecture, real-time processing, and production-grade DevOps/SRE practices

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://golang.org/)
[![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://typescriptlang.org/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?logo=kubernetes)](https://kubernetes.io/)

**Version**: 0.18.0 | **Status**: Production Ready

## Portfolio Highlights

- 🏗️ **Multi-language Backend**: 6 microservices in 4 languages (Go, Java, Python, TypeScript)
- ⚡ **Real-time Processing**: Flink CEP for stream processing, Spark for batch analytics
- 🚀 **DevOps/SRE**: K8s + Helm + ArgoCD GitOps, full observability stack
- 🔒 **Security**: Vault secrets, Gitleaks/Trivy scanning, security hardening
- 📊 **Observability**: Prometheus, Grafana, Loki, Jaeger distributed tracing
- 🧪 **Testing**: Unit, integration, load testing with custom generator

---

## Quick Start

```bash
# Clone and setup
git clone https://github.com/tihaya-anon/chain-risk-platform.git
cd chain-risk-platform
cp .env.example .env.local

# Start everything
make up-all

# Validate
make smoke-test
```

---

## Architecture

**Lambda Architecture** with batch and stream processing:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  BFF (NestJS) + WebSocket                   │
│       Gateway / JWT / Rate Limiting / Circuit Breaker       │
└───────┬─────────────┬─────────────┬─────────────┬───────────┘
        │             │             │             │
   ┌────▼────┐  ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
   │  Query  │  │   Risk    │ │   Alert   │ │   Graph   │
   │   Go    │  │  Python   │ │    Go     │ │   Java    │
   └────┬────┘  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
        │             │             │             │
┌───────┴─────────────┴─────────────┴─────────────┴───────────┐
│   PostgreSQL    Redis    Kafka    Neo4j    Nacos    Vault   │
└───────────────────────────────┬───────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
              ┌─────▼─────┐         ┌──────▼──────┐
              │   Flink   │         │    Spark    │
              │  (Stream) │         │   (Batch)   │
              └───────────┘         └─────────────┘
```

**Key Patterns**:
- Event-driven architecture with Kafka
- CQRS (Command Query Responsibility Segregation)
- Circuit Breaker, Rate Limiting, Retry with backoff
- Distributed tracing across all services
- Centralized logging with structured logs

---

## Project Structure

```
services/              # Backend business services
├── bff/               # Gateway (TypeScript)
├── query-service/     # Queries (Go)
├── risk-ml-service/   # ML (Python)
├── alert-service/     # Alerts (Go)
└── graph-service/     # Graph (Java)

data-ingestion/        # On-chain data collection
mempool-collector/     # Mempool data collection

processing/            # Data processing
├── stream-processor/  # Flink
└── batch-processor/   # Spark

tools/                 # Development tools
└── load-generator/    # Load testing
```

---

## Services

| Service | Tech Stack | Port | Key Features |
|---------|-----------|------|--------------|
| **bff** | TypeScript/NestJS | 3001 | API Gateway, WebSocket, Circuit Breaker, Rate Limiting, JWT Auth |
| **query-service** | Go/Gin | 8081 | RESTful API, PostgreSQL, Redis caching, Prometheus metrics |
| **risk-ml-service** | Python/FastAPI | 8082 | ML scoring, async processing, scikit-learn |
| **alert-service** | Go/Gin | 8083 | Real-time alerts, Kafka consumer, WebSocket push |
| **graph-service** | Java/Spring Boot | 8084 | Neo4j graph analysis, JPA, Spring Data |
| **mempool-collector** | Go | 9090 | WebSocket streaming, Kafka producer, high-throughput |

### Processing Layer

| Component | Tech | Purpose |
|-----------|------|---------|
| **stream-processor** | Apache Flink (Java) | Real-time CEP, pattern detection, millisecond latency |
| **batch-processor** | Apache Spark (Java) | Historical analytics, ML training, data aggregation |

### Infrastructure

- **Message Queue**: Kafka (event streaming)
- **Databases**: PostgreSQL (relational), Neo4j (graph), Redis (cache)
- **Service Discovery**: Nacos
- **Secrets Management**: HashiCorp Vault
- **Observability**: Prometheus + Grafana + Loki + Jaeger

---

## Development Phases

| Phase | Content | Status |
|-------|---------|--------|
| 1-4 | Core Infrastructure (Docker, Kafka, PostgreSQL, Redis) | ✅ |
| 5-7 | Backend Services (Go, Python, Java, TypeScript) | ✅ |
| 8-9 | BFF Gateway & Alert System | ✅ |
| 10-11 | ML Service & Graph Analysis (Neo4j) | ✅ |
| 12 | **Observability & SRE** (Prometheus, Grafana, Loki, Jaeger) | ✅ |
| 13 | **Security Hardening** (Vault, Gitleaks, Trivy, RBAC) | ✅ |
| 14 | **CI/CD Pipeline** (GitHub Actions, multi-stage builds) | ✅ |
| 15 | **Performance Testing** (Load generator, benchmarking) | ✅ |
| 16 | BFF Consolidation & WebSocket | ✅ |
| 17 | **AIOps Foundation** (SLO, Error Budget, Runbooks) | ✅ |
| 18 | **Real-time Processing + K8s** (Flink CEP, Helm, ArgoCD) | ✅ |

### Technical Achievements

**Multi-language Backend (95%)**:
- 6 production microservices in 4 languages
- RESTful APIs + WebSocket real-time communication
- Distributed tracing across all services
- Comprehensive unit + integration tests

**DevOps/SRE (90%)**:
- Full observability stack with SLO tracking
- Kubernetes deployment with Helm charts
- GitOps with ArgoCD
- Security scanning in CI/CD pipeline
- Chaos engineering scenarios
- Custom load testing tool

---

## Commands

```bash
# Docker
make up-all              # Start all services
make down-all            # Stop all services

# Development
make smoke-test          # Service health check
make test-unit           # Unit tests
make test-integration    # Integration tests

# Data collectors
make mempool-build       # Build mempool collector
make mempool-run         # Run mempool collector

# Tools
make loadgen-run         # Run load generator

# Security
make vault-init          # Initialize Vault
```

---

## Documentation

- [AI Context](AI_CONTEXT.md) - Quick reference for AI assistants
- [Project Goals](PROJECT_GOALS.md) - Portfolio objectives and progress
- [Project Overview](docs/architecture/overview/PROJECT_OVERVIEW.md) - Detailed architecture
- [Development SOP](docs/operations/runbooks/DEV_SOP.md) - Development procedures
- [Roadmap](docs/ROADMAP.md) - Development phases

### Key Technical Docs

- **Architecture**: Lambda architecture, microservices patterns
- **DevOps/SRE**: K8s deployment, observability, SLO tracking
- **Security**: Vault integration, secrets scanning, RBAC
- **Testing**: Unit, integration, load testing strategies

---

## License

MIT
