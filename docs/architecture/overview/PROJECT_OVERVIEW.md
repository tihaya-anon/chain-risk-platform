# Project Overview

Blockchain address risk assessment platform using Lambda Architecture.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Gateway/BFF | TypeScript/NestJS |
| Services | Go/Gin, Java/Spring, Python/FastAPI |
| Stream | Kafka, Flink |
| Batch | Spark, Hudi |
| Storage | PostgreSQL, Neo4j, Redis |
| Observability | Prometheus, Grafana, Loki, Jaeger |

## Architecture

```
Frontend → BFF (TS) → Services (Go/Java/Python)
                            ↓
         Kafka → Flink/Spark → PostgreSQL/Neo4j/Hudi
```

## Service Responsibilities

| Service | Language | Function |
|---------|----------|----------|
| bff | TypeScript | Gateway, Auth, API aggregation |
| query-service | Go | Address data queries |
| risk-ml-service | Python | ML risk scoring |
| alert-service | Go | Alert management |
| graph-service | Java | Graph analysis (Neo4j) |

## Related Docs

- [AI_CONTEXT](../../../AI_CONTEXT.md) - Entry point
- [BFF Architecture](../components/BFF_ARCHITECTURE.md)
- [Tech Decisions](../decisions/TECH_DECISIONS.md)
- [Lambda Architecture](../components/LAMBDA_ARCHITECTURE.md)
