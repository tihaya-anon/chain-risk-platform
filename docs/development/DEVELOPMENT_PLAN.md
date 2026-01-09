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

## Phase 4: Advanced Features ✅ Complete

### 4.1 Graph Service ✅ Complete
- [x] Neo4j integration
- [x] Address clustering (Union-Find)
- [x] Tag propagation (BFS)
- [x] Graph query API

### 4.2 ML Risk Model ✅ Complete
- [x] Feature pipeline (Spark batch jobs)
- [x] Label ingestion (OFAC, Tornado Cash, Exchange)
- [x] Training data preparation
- [x] XGBoost model training
- [x] Isolation Forest training
- [x] Model serving

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

## Phase 6: ML with GNN 🔶 90%

**Goal**: Graph Neural Networks for enhanced risk detection

### Completed
- [x] GNN model architecture (GraphSAGE, GAT)
- [x] GNN training pipeline
- [x] GNN predictor integration
- [x] Ensemble model (XGBoost + GNN)
- [x] Unit tests

### Pending
- [ ] End-to-end tests

---

## Timeline

```
Week 1-3:   Phase 1 - Core Data Flow ✅
Week 4-6:   Phase 2 - Query & Risk Services ✅
Week 7-8:   Phase 3 - BFF & Frontend 🔶 (80%)
Week 9-12:  Phase 4 - Advanced Features ✅
Week 13-14: Phase 5 - Alert Service ✅
Week 15+:   Phase 6 - ML with GNN 🔶 (90%)
```

---

## Milestones

| Milestone | Criteria | Status |
|-----------|----------|--------|
| M1 | Data ingestion → DB | ✅ |
| M2 | Query API + Risk scoring | ✅ |
| M3 | Demonstrable demo | 🔶 80% |
| M4 | Graph + ML features | ✅ |
| M5 | Alert Service | ✅ |
| M6 | GNN integration | 🔶 90% |

---

## Remaining Tasks

| Task | Priority | Phase |
|------|----------|-------|
| GNN end-to-end tests | High | 6 |
| K8s deployment | Low | 3 |
| Monitoring setup | Low | 3 |

---

## Recent Updates

### 2026-01-09
- ✅ **GNN development completed** (feature/gnn-development, feature/gnn-testing)
  - GNN model training and prediction
  - Ensemble integration
  - Unit tests passing
  - Pending: End-to-end tests

- ✅ **Alert Service completed** (32 tasks)
  - Full implementation with Kafka consumer, rule engine, notifications
  - Unit tests + Integration tests passing
  - OpenAPI documentation

### 2026-01-06
- ✅ Graph Service refactoring (moved to `services/graph-service`)

### 2026-01-05
- ✅ ML Feature Pipeline (FeatureComputeJob, LabelIngestionJob, TrainingDataPrepareJob)
