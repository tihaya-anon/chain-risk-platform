# Chain Risk Platform - Project Overview

> Multi-language microservice blockchain risk analysis system (Lambda Architecture)

## Project Goals

### Triple Purpose

1. **Web3 Domain Expertise**: Blockchain data processing, compliance analysis, on-chain risk detection
2. **Backend Development**: Multi-language microservices for freelance opportunities
3. **SRE/Operations**: Reliability engineering, chaos testing, incident response

---

## Tech Stack Summary

| Domain | Technology | Proficiency |
|--------|------------|-------------|
| **Core** | Java/Flink/Kafka + Blockchain Data | ⭐⭐⭐⭐⭐ |
| **Backend** | SpringBoot, Go Gin/GORM | ⭐⭐⭐⭐ |
| **AI/ML** | PyTorch, Pandas, ML/RL | ⭐⭐⭐⭐ |
| **Frontend** | Vue, React | ⭐⭐⭐ |
| **SRE/DevOps** | Docker, K8s, Prometheus, Chaos Engineering | ⭐⭐⭐⭐ |

---

## System Architecture (Lambda)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│              Orchestrator (Java/Spring Cloud Gateway)               │
│         JWT Auth / Routing / Rate Limiting / Circuit Breaker        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                      BFF Layer (TypeScript/Nest.js)                 │
└───────────┬─────────────────────┬─────────────────────┬─────────────┘
            │                     │                     │
┌───────────▼───────────┐ ┌───────▼───────┐ ┌───────────▼───────────┐
│    Query Service      │ │ Graph Service │ │     Risk Service      │
│        (Go)           │ │    (Java)     │ │       (Python)        │
└───────────┬───────────┘ └───────┬───────┘ └───────────┬───────────┘
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
┌──────────────────────▼─────────────────────▼────────────────────────┐
│                     Data & Processing Layer                         │
│  Data Ingestion (Go) → Kafka → Flink → PostgreSQL / Neo4j           │
│                                  ↓                                  │
│                    Spark Batch → Hudi (Data Lake)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Language Responsibilities

| Module | Language | Responsibility | Reuse Scenario |
|--------|----------|----------------|----------------|
| **Orchestrator** | Java/Spring | API Gateway, Auth | Enterprise Gateway |
| **BFF** | TypeScript/NestJS | Business Aggregation | BFF projects |
| **Query/Alert** | Go/Gin | High-perf microservices | CRUD backend |
| **Graph Service** | Java/Spring+Neo4j | Graph analysis | Graph DB apps |
| **Risk ML** | Python/FastAPI | ML inference | AI projects |
| **Flink Stream** | Java/Flink | Real-time processing | Streaming projects |
| **Spark Batch** | Java/Spark | Batch processing | Big data projects |

---

## Related Documentation

- [Roadmap](../../ROADMAP.md)
- [Lambda Architecture](../components/LAMBDA_ARCHITECTURE.md)
- [Tech Decisions](../decisions/TECH_DECISIONS.md)
- [API Specs](../../api-specs/)

---

**Last Updated**: 2026-01-12
