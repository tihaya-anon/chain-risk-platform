# Development Status

> Current development status and recent changes

**Last Updated**: 2026-01-09

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Data Ingestion | ✅ | Go, Etherscan API |
| Stream Processing | ✅ | Flink, dual-write |
| Query Service | ✅ | Go/Gin |
| Risk Service | ✅ | Python/FastAPI |
| Graph Service | ✅ | Java/Neo4j |
| Alert Service | ✅ | Go/Gin, Kafka consumer |
| BFF | ✅ | TypeScript/NestJS |
| Frontend | ✅ | React |
| ML Pipeline | 🔶 | Feature pipeline done, training pending |

---

## Recent Changes

### 2026-01-09: Alert Service Complete

**32 tasks completed**:
- Kafka consumer for `risk-scores` and `transfers` topics
- Rule engine with 6 evaluator types
- Multi-channel notifications (Webhook, Email, Slack)
- Redis deduplication
- Full REST API
- Unit + Integration tests passing

**Files Added**:
```
services/alert-service/
├── cmd/main.go
├── internal/
│   ├── config/
│   ├── engine/         # Rule evaluators
│   ├── handler/        # REST API
│   ├── kafka/          # Consumer
│   ├── model/
│   ├── notifier/       # Webhook, Email, Slack
│   ├── repository/
│   └── service/
├── configs/
└── docs/openapi.json
```

### 2026-01-06: Graph Service Refactoring

- Moved `processing/graph-engine` → `services/graph-service`
- Removed deprecated PostgreSQL → Neo4j sync
- Data now via Flink dual-write

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Sources                             │
│  Etherscan API → Kafka → Flink → PostgreSQL + Neo4j        │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Query   │  │  Graph   │  │   Risk   │  │  Alert   │
│ Service  │  │ Service  │  │ Service  │  │ Service  │
│  (Go)    │  │  (Java)  │  │ (Python) │  │  (Go)    │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
    │                         │                         │
    └─────────────────────────┼─────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │      BFF        │
                     │  (TypeScript)   │
                     └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │    Frontend     │
                     │    (React)      │
                     └─────────────────┘
```

---

## Pending Tasks

| Task | Priority | Notes |
|------|----------|-------|
| XGBoost model training | Medium | After feature pipeline |
| Isolation Forest training | Medium | Anomaly detection |
| Model serving API | Medium | risk-ml-service |
| K8s deployment | Low | Production readiness |
| Prometheus + Grafana | Low | Monitoring |

---

## Branch Status

| Branch | Focus | Status |
|--------|-------|--------|
| `feature/alert-service` | Alert Service | ✅ Complete |
| `feature/ml-gnn` | GNN Integration | 🔶 In Progress |
