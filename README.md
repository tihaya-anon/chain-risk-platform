# Chain Risk Platform

> Multi-language microservice blockchain risk analysis system (Lambda Architecture)

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/) [![Java](https://img.shields.io/badge/Java-17+-ED8B00?style=flat&logo=openjdk)](https://openjdk.org/) [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python)](https://python.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://typescriptlang.org/)

## Overview

A Lambda Architecture-based on-chain transaction analysis and address risk assessment platform supporting:

- **Real-time Stream Processing**: Flink parses on-chain transactions in seconds, dual-writes to PostgreSQL + Neo4j
- **Batch Processing Override**: Spark daily corrections ensuring eventual consistency
- **Risk Scoring**: Rule engine + ML model (real-time + batch)
- **Address Clustering**: Graph algorithms for entity identification (Common Input Heuristic)
- **Tag Propagation**: BFS multi-hop risk propagation (incremental + batch)
- **Alert System**: Real-time anomaly transaction alerts

## Lambda Architecture

### Core Concept
- **Speed Layer (Flink)**: Real-time stream processing, sub-second response, may have errors
- **Batch Layer (Spark + Hudi)**: Batch processing override, accurate correction, T+1 day
- **Serving Layer (Microservices)**: Merged view, unified query

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React/TypeScript)                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                 Orchestrator (Java/Spring Cloud Gateway)            │
│             JWT Auth / Routing / Rate Limiting / Circuit Breaker    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ X-User-Id/Username/Role
┌─────────────────────────────────▼───────────────────────────────────┐
│                      BFF Layer (TypeScript/Nest.js)                 │
│                Business Aggregation / Data Transform                │
└───────────┬─────────────────────┬─────────────────────┬─────────────┘
            │                     │                     │
┌───────────▼───────────┐ ┌───────▼───────┐ ┌─────────────▼───────────┐
│    Query Service      │ │ Graph Service │ │      Risk Service       │
│        (Go)           │ │    (Java)     │ │        (Python)         │
└───────────┬───────────┘ └───────┬───────┘ └───────────┬─────────────┘
            │                     │                     │
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
┌──────────────────────▼─────────────────────▼────────────────────────┐
│                  Data & Processing Layer (Lambda)                   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────┐         │
│  │         Data Ingestion (Go) → Kafka Topics             │         │
│  └─────────────────────────┬──────────────────────────────┘         │
│                            │                                        │
│       ┌────────────────────┴────────────────┐                       │
│       │                                     │                       │
│       ▼                                     ▼                       │
│  ┌──────────────┐                     ┌──────────────┐              │
│  │ Speed Layer  │                     │ Batch Layer  │              │
│  │ Flink Stream │                     │ Spark + Hudi │              │
│  │ (real-time)  │                     │ (daily batch)│              │
│  └────┬─────┬───┘                     └────┬─────┬───┘              │
│       │     │                              │     │                  │
│       ▼     ▼                              ▼     ▼                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐         │
│  │ PostgreSQL   │     │    Neo4j     │     │ Hudi (MinIO) │         │
│  │ (hot, 7 days)│     │   (graph)    │     │ (cold data)  │         │
│  └──────────────┘     └──────────────┘     └──────────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

See detailed architecture at:
- [Project Overview](./docs/architecture/PROJECT_OVERVIEW.md)
- [Lambda Architecture Guide](./docs/architecture/LAMBDA_ARCHITECTURE.md)

## Tech Stack

| Layer            | Technology                                | Description                 |
| ---------------- | ----------------------------------------- | --------------------------- |
| **Frontend**     | React, TypeScript, Vite                   | Risk Dashboard              |
| **Orchestrator** | Java, Spring Cloud Gateway, Resilience4j  | API Gateway + Orchestration |
| **BFF**          | Nest.js, TypeScript                       | Business Aggregation        |
| **Services**     | Go (Gin), Java (Spring), Python (FastAPI) | Microservices               |
| **Speed Layer**  | Apache Flink, Kafka                       | Real-time Stream            |
| **Batch Layer**  | Apache Spark, Hudi                        | Batch Processing            |
| **Graph**        | Java, Spring Boot, Neo4j                  | Graph Analysis Service      |
| **Storage**      | PostgreSQL, Neo4j, Redis, MinIO           | Data Storage                |
| **Infra**        | Docker, Kubernetes                        | Infrastructure              |

## Project Structure

```
chain-risk-platform/
├── services/               # Microservices (Serving Layer)
│   ├── orchestrator/       # Java/Spring Cloud Gateway - API Gateway
│   ├── bff/                # TypeScript/Nest.js - Business Aggregation
│   ├── query-service/      # Go/Gin - Address/Transaction Query
│   ├── graph-service/      # Java/Spring Boot + Neo4j - Graph Analysis
│   ├── risk-ml-service/    # Python/FastAPI - Risk Scoring
│   └── alert-service/      # Go/Gin - Alert Service
│
├── processing/             # Data Processing (Speed + Batch Layer)
│   ├── stream-processor/   # Java/Flink - Real-time Stream Processing
│   │   ├── Transfer parsing
│   │   └── Dual-write PostgreSQL + Neo4j
│   │
│   └── batch-processor/    # Java/Spark + Hudi - Batch Layer
│       ├── ArchiveToHudiJob - PostgreSQL → Hudi archival
│       ├── HudiBatchCorrectionJob - Risk score correction
│       └── Writes to Hudi data lake (MinIO)
│
├── data-ingestion/         # Go - On-chain Data Collection
├── ml-training/            # Python - ML Model Training
├── frontend/               # React - Risk Dashboard
├── infra/                  # Infrastructure Config
│   ├── docker-compose.yml
│   ├── k8s/
│   ├── hive/               # Hive Metastore for Hudi
│   └── trino/              # Trino query engine
│
└── docs/                   # Documentation
    ├── architecture/       # Architecture Design
    ├── development/        # Development Plans
    ├── operations/         # Operation Guides
    └── api-specs/          # API Specifications
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.21+
- Java 17+
- Python 3.11+
- Node.js 18+

### Start Development Environment

```bash
# 1. Clone repository
git clone https://github.com/0ksks/chain-risk-platform.git
cd chain-risk-platform

# 2. Start infrastructure (PostgreSQL, Neo4j, Kafka, Redis, MinIO, Hive, Trino)
docker-compose up -d

# 3. Start services
make run-svc

# 4. Check service status
make infra-check
```

### Service Ports

| Service         | Port  | Description          |
| --------------- | ----- | -------------------- |
| Orchestrator    | 8080  | API Gateway          |
| BFF             | 3001  | Business Aggregation |
| Query Service   | 8081  | Query Service        |
| Risk ML Service | 8082  | Risk Scoring Service |
| Alert Service   | 8083  | Alert Service        |
| Graph Service   | 8084  | Graph Analysis       |
| Frontend        | 5173  | Frontend Dashboard   |
| PostgreSQL      | 15432 | RDBMS                |
| Neo4j           | 17474 | Graph DB (HTTP)      |
| Neo4j Bolt      | 17687 | Graph DB (Bolt)      |
| Redis           | 16379 | Cache                |
| Kafka           | 19092 | Message Queue        |
| MinIO           | 19000 | Object Storage       |
| Trino           | 18081 | Query Engine         |

## Documentation

### Architecture
- [📖 Project Overview](./docs/architecture/PROJECT_OVERVIEW.md)
- [🏗️ Lambda Architecture](./docs/architecture/LAMBDA_ARCHITECTURE.md)
- [🔧 Tech Decisions](./docs/architecture/TECH_DECISIONS.md)
- [🌐 Gateway+BFF Architecture](./docs/architecture/GATEWAY_BFF_ARCHITECTURE.md)

### Development
- [📅 Development Plan](./docs/development/DEVELOPMENT_PLAN.md)
- [📊 Progress](./docs/development/PROGRESS.md)
- [🧪 Test Plan](./docs/development/PHASE1_TEST_PLAN.md)
- [📦 Hudi Batch Layer](./docs/development/HUDI_BATCH_LAYER.md)

### Operations
- [🚀 Scripts Quick Reference](./docs/operations/SCRIPTS_QUICK_REFERENCE.md)
- [📝 Scripts Guide](./scripts/README.md)
- [🔄 Git Workflow](./docs/operations/GIT_WORKFLOW.md)

### API Documentation
- [📡 API Specs Guide](./docs/api-specs/API_SPECS_GUIDE.md)
- [🔗 API Quick Reference](./docs/api-specs/API_SPECS_QUICK_REF.md)

### Full Navigation
- [📖 Documentation Center](./docs/README.md)

## Makefile Commands

View all available commands:
```bash
make help
```

### Common Commands

```bash
# Infrastructure
make infra-up          # Start infrastructure
make infra-down        # Stop infrastructure
make infra-check       # Check infrastructure status

# Services
make run-svc           # Start all services (background)
make stop-svc          # Stop all services
make logs-all          # View all logs

# Build and Test
make init-all          # Initialize all services
make build-all         # Build all services
make test-all          # Run all tests

# Batch Processing (Hudi)
make batch-build       # Build batch processor
make batch-archive     # Run archive job (PostgreSQL → Hudi)
make batch-correct     # Run batch correction job
```

See [Scripts Quick Reference](./docs/operations/SCRIPTS_QUICK_REFERENCE.md) for details.

## Core Features

### 1. Lambda Architecture - Stream-Batch Unified

| Feature      | Speed Layer (Flink)      | Batch Layer (Spark)   |
| ------------ | ------------------------ | --------------------- |
| **Latency**  | Sub-second               | T+1 day               |
| **Accuracy** | Medium (may have errors) | High (complete parse) |
| **Source**   | Kafka real-time          | Full node RPC rescan  |
| **Strategy** | Dual-write PG + Neo4j    | Override with Hudi    |
| **Use Case** | Real-time query, alerts  | Data correction       |

### 2. Graph Analysis - Incremental + Batch

| Analysis        | Trigger         | Scope       | Algorithm              |
| --------------- | --------------- | ----------- | ---------------------- |
| **Incremental** | Kafka message   | Local graph | Incremental clustering |
| **Batch**       | Daily scheduler | Full graph  | PageRank, Louvain      |

### 3. Data Lake (Hudi)

- **Hot Data**: PostgreSQL (7 days)
- **Cold Data**: Hudi on MinIO (historical)
- **Query**: Trino SQL federation

## Roadmap

- [x] Project planning and documentation
- [x] Phase 1: Core data flow (Flink Stream)
- [x] Phase 2: Query and Risk services (basic)
- [x] Phase 3: BFF and Frontend (basic)
- [x] Lambda architecture design
- [x] Phase 4: Spark + Hudi batch processing
- [ ] Phase 5: Graph Service optimization
- [ ] Phase 6: Advanced features (ML models)

## Contributing

See [Git Workflow Guide](./docs/operations/GIT_WORKFLOW.md)

## License

MIT License

---

**Last Updated**: 2026-01-06
