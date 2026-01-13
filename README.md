# Chain Risk Platform

> Blockchain address risk assessment platform with Lambda Architecture

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://golang.org/)
[![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://typescriptlang.org/)

**Version**: 0.11.0 | **Status**: Production Ready

---

## Quick Start

```bash
# Clone and setup
git clone https://github.com/tihaya-anon/chain-risk-platform.git
cd chain-risk-platform
cp .env.example .env.local  # Configure DOCKER_HOST_IP

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
│          Gateway / JWT / RBAC / Rate Limiting               │
│           Orchestration / Circuit Breaker                   │
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
                          │
┌─────────────────────────▼───────────────────────────────────┐
│       Prometheus    Grafana    Loki    Jaeger (ES)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Services

| Service | Tech | Port | Health |
|---------|------|------|--------|
| query-service | Go/Gin | 8081 | `/health` |
| risk-ml-service | Python/FastAPI | 8082 | `/health` |
| alert-service | Go/Gin | 8083 | `/health` |
| graph-service | Java/Spring | 8084 | `/actuator/health` |
| bff | TypeScript/NestJS | 3001 | `/health` |

---

## Commands

```bash
# Docker
make up-all              # Start all services
make down-all            # Stop all services
make docker-build        # Build all images

# Development
make smoke-test          # Service health check

# Vault
make vault-init          # Initialize Vault
make vault-secrets-seed  # Seed secrets
make vault-secrets-verify # Verify secrets

# Monitoring
make jaeger-trace-test   # Verify tracing
make jaeger-ilm-setup    # Setup retention policy
```

---

## Infrastructure Ports

| Service | Port |
|---------|------|
| PostgreSQL | 15432 |
| Redis | 16379 |
| Kafka | 19092 |
| Neo4j | 17687 |
| Nacos | 18848 |
| Vault | 18200 |
| Prometheus | 19090 |
| Grafana | 13001 |
| Loki | 13100 |
| Jaeger | 26686 |
| Elasticsearch | 19200 |

---

## Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Future plans |
| [docs/deployment/](./docs/deployment/) | Deployment guides |
| [docs/architecture/](./docs/architecture/) | Architecture design |
| [docs/development/](./docs/development/) | Development guides |

---

## Development Phases

| Phase | Content | Status |
|-------|---------|--------|
| 1-4 | Core Data Flow, Services, Frontend, Graph+ML | ✅ |
| 5 | Alert Service | ✅ |
| 6 | GNN Integration | ✅ |
| 7 | Production Readiness | ✅ |
| 8 | Observability Stack | ✅ |
| 9 | Batch Orchestration (Airflow) | ✅ |
| 10 | Production Hardening | ✅ |
| 11 | BFF Consolidation | ✅ |
| 12 | Performance Testing | 📋 Planned |
| 13 | Security Hardening | 📋 Planned |

---

## License

MIT

---

**Last Updated**: 2026-01-13
