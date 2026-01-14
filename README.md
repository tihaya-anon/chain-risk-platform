# Chain Risk Platform

> Blockchain address risk assessment platform with Lambda Architecture

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://golang.org/)
[![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://typescriptlang.org/)

**Version**: 0.18.0 | **Status**: Production Ready

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
└─────────────────────────────────────────────────────────────┘
```

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

| Service | Tech | Port | Health |
|---------|------|------|--------|
| bff | TypeScript/NestJS | 3001 | `/health` |
| query-service | Go/Gin | 8081 | `/health` |
| risk-ml-service | Python/FastAPI | 8082 | `/health` |
| alert-service | Go/Gin | 8083 | `/health` |
| graph-service | Java/Spring | 8084 | `/actuator/health` |
| mempool-collector | Go | 9090 | `/health` |

---

## Development Phases

| Phase | Content | Status |
|-------|---------|--------|
| 1-4 | Core Infrastructure | ✅ |
| 5-7 | Backend Services | ✅ |
| 8-9 | BFF & Alerts | ✅ |
| 10-11 | ML & Graph | ✅ |
| 12 | Observability & SRE | ✅ |
| 13 | Security Hardening | ✅ |
| 14 | CI/CD Pipeline | ✅ |
| 15 | Performance Testing | ✅ |
| 16 | BFF Consolidation | ✅ |
| 17 | AIOps Foundation | ✅ |
| 18 | MEV Detection + K8s | ✅ |

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

- [AI Context](AI_CONTEXT.md) - Entry point for AI assistants
- [Project Overview](docs/architecture/overview/PROJECT_OVERVIEW.md)
- [Development SOP](docs/operations/runbooks/DEV_SOP.md)
- [Risk Taxonomy](docs/business/CRYPTO_RISK_TAXONOMY.md)

---

## License

MIT
