# Chain Risk Platform - Development Plan

## MVP Phases

---

## Phase 1: Core Data Flow ✅ Complete

**Goal**: Chain data → Kafka → Flink → DB pipeline

- [x] Docker Compose (Kafka, PostgreSQL, Redis)
- [x] Data Ingestion (Go) - Etherscan API, Kafka Producer
- [x] Stream Processor (Flink) - Kafka Consumer, PostgreSQL Sink
- [x] Integration Test Framework - Mock Server, Fixtures

---

## Phase 2: Query & Risk Services ✅ Complete

**Goal**: Basic query API and risk scoring

- [x] Query Service (Go/Gin) - Address/transfer queries, Redis cache
- [x] Risk Service (Python/FastAPI) - Rule-based scoring
- [x] Orchestrator (Java/Spring Cloud Gateway) - Auth, routing, rate limiting
- [x] Nacos integration - All services

---

## Phase 3: BFF & Frontend 🔶 80%

**Goal**: Demonstrable product

### Completed
- [x] BFF (TypeScript/NestJS) - API aggregation, Gateway trust mode
- [x] Frontend (React) - Dashboard, Address, Risk, Graph pages
- [x] Dark mode support

### Pending
- [ ] K8s deployment
- [ ] Monitoring (Prometheus + Grafana)

---

## Phase 4: Advanced Features 🔶 70%

### 4.1 Graph Service ✅ Complete
- [x] Neo4j integration
- [x] Address clustering (Union-Find)
- [x] Tag propagation (BFS)
- [x] Graph query API

### 4.2 ML Risk Model 🔶 30%
- [x] Feature pipeline (Spark batch jobs)
- [x] Label ingestion (OFAC, Tornado Cash, Exchange)
- [x] Training data preparation
- [ ] XGBoost model training
- [ ] Isolation Forest training
- [ ] Model serving

### 4.3 Batch Processing ✅ Complete
- [x] Archive job (PostgreSQL → Hudi)
- [x] Correction job (risk scoring)
- [x] Feature compute job

---

## Phase 5: Alert Service ✅ Complete

**Goal**: Real-time alerting and notification system

**Completed**: 2026-01-09

### Delivered
- [x] Kafka consumer (risk-scores, transfers topics)
- [x] Alert engine with rule evaluators
- [x] 6 rule types: risk_score, transaction_value, tag_match, velocity, cluster_risk
- [x] Multi-channel notifications: Webhook, Email, Slack
- [x] Redis deduplication
- [x] PostgreSQL persistence (rules, history, subscriptions)
- [x] REST API (CRUD for rules, subscriptions, history)
- [x] Nacos integration
- [x] OpenAPI documentation
- [x] Unit tests (evaluators, notifiers)
- [x] Integration tests

**Documentation**: [Alert Service Implementation Guide](./ALERT_SERVICE_IMPLEMENTATION.md)

---

## Phase 6: ML with GNN 🔀 Separate Branch

**Goal**: Graph Neural Networks for enhanced risk detection

**Branch**: `feature/ml-gnn`

---

## Timeline

```
Week 1-3:   Phase 1 - Core Data Flow ✅
Week 4-6:   Phase 2 - Query & Risk Services ✅
Week 7-8:   Phase 3 - BFF & Frontend 🔶 (80%)
Week 9-12:  Phase 4 - Advanced Features 🔶 (70%)
Week 13-14: Phase 5 - Alert Service ✅
Week 15+:   Phase 6 - ML with GNN (separate branch)
```

---

## Milestones

| Milestone | Criteria | Status |
|-----------|----------|--------|
| M1 | Data ingestion → DB | ✅ |
| M2 | Query API + Risk scoring | ✅ |
| M3 | Demonstrable demo | 🔶 80% |
| M4 | Graph + ML features | 🔶 70% |
| M5 | Alert Service | ✅ |
| M6 | GNN integration | 🔀 separate branch |

---

## Remaining Tasks

| Task | Priority | Phase |
|------|----------|-------|
| XGBoost model training | Medium | 4.2 |
| Isolation Forest training | Medium | 4.2 |
| Model serving API | Medium | 4.2 |
| K8s deployment | Low | 3 |
| Monitoring setup | Low | 3 |

---

## Recent Updates

### 2026-01-09
- ✅ **Alert Service completed** (32 tasks)
  - Full implementation with Kafka consumer, rule engine, notifications
  - Unit tests + Integration tests passing
  - OpenAPI documentation

### 2026-01-06
- ✅ Graph Service refactoring (moved to `services/graph-service`)

### 2026-01-05
- ✅ ML Feature Pipeline (FeatureComputeJob, LabelIngestionJob, TrainingDataPrepareJob)
