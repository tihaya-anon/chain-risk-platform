# Chain Risk Platform

> Blockchain address risk assessment platform with Lambda Architecture

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://golang.org/)
[![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://typescriptlang.org/)

**Version**: 0.17.0 | **Status**: Production Ready

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
                          │
┌─────────────────────────▼───────────────────────────────────┐
│       Prometheus    Grafana    Loki    Jaeger (ES)          │
└─────────────────────────────────────────────────────────────┘
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

# Security
make vault-init          # Initialize Vault
./tests/security/tls-suite.sh  # TLS verification
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [docs/architecture/](./docs/architecture/) | Architecture design |
| [docs/api-specs/](./docs/api-specs/) | OpenAPI specs |
| [docs/sre/](./docs/sre/) | SLO & runbooks |

---

## License

MIT

---

**Last Updated**: 2026-01-14
