# Chain Risk Platform - Development Plan

## MVP Phases

---

## Phase 1: Core Data Flow ✅

**Goal**: Chain data → Kafka → Flink → DB pipeline

- [x] Docker Compose (Kafka, PostgreSQL, Redis)
- [x] Data Ingestion (Go) - Etherscan API, Kafka Producer
- [x] Stream Processor (Flink) - Kafka Consumer, PostgreSQL Sink
- [x] Integration Test Framework - Mock Server, Fixtures

---

## Phase 2: Query & Risk Services ✅

**Goal**: Basic query API and risk scoring

- [x] Query Service (Go/Gin) - Address/transfer queries, Redis cache
- [x] Risk Service (Python/FastAPI) - Rule-based scoring
- [x] Orchestrator (Java/Spring Cloud Gateway) - Auth, routing, rate limiting
- [x] Nacos integration - All services

---

## Phase 3: BFF & Frontend ✅

**Goal**: Demonstrable product

- [x] BFF (TypeScript/NestJS) - API aggregation, Gateway trust mode
- [x] Frontend (React) - Dashboard, Address, Risk, Graph pages
- [x] Dark mode support

---

## Phase 4: Advanced Features ✅

- [x] Graph Service - Neo4j, clustering, tag propagation
- [x] ML Risk Model - Feature pipeline, XGBoost, Isolation Forest
- [x] Batch Processing - Archive, correction, feature compute jobs

---

## Phase 5: Alert Service ✅

**Completed**: 2026-01-09

- [x] Kafka consumer (risk-scores, transfers topics)
- [x] Alert engine with rule evaluators (6 types)
- [x] Multi-channel notifications (Webhook, Email, Slack)
- [x] REST API + Nacos integration

---

## Phase 6: ML with GNN ✅

**Completed**: 2026-01-09

- [x] GNN model architecture (GraphSAGE, GAT)
- [x] Training pipeline + predictor integration
- [x] Ensemble model (XGBoost + GNN)
- [x] Unit tests

---

## Phase 7: Production Readiness 🔶 In Progress

**Goal**: Integration testing, deployment, monitoring

See [ROADMAP_PHASE7.md](./ROADMAP_PHASE7.md) for detailed checkpoint breakdown.

### Checkpoint Status

| CP | Name | Status | Depends |
|----|------|--------|---------|
| 1 | Remote Infra Verify | ⏳ | - |
| 2 | Data Generator | ⏳ | 1 |
| 3 | Rolling Cleanup | ⏳ | 1 |
| 4 | Metrics Export | ⏳ | 1 |
| 5 | E2E Test Suite | ⏳ | 2, 3 |
| 6 | GNN E2E Tests | ⏳ | 5 |
| 7 | K8s Manifests | ⏳ | 6 |
| 8 | Grafana Dashboards | ⏳ | 4, 6 |
| 9 | Staging Deploy | ⏳ | 7, 8 |

### DAG

```
CP-1 ──┬── CP-2 ──┐
       ├── CP-3 ──┼── CP-5 ── CP-6 ──┬── CP-7 ──┐
       └── CP-4 ──┘            │     └── CP-8 ──┼── CP-9
                               └────────────────┘
```

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1-2 | Week 1-6 | ✅ |
| Phase 3 | Week 7-8 | ✅ |
| Phase 4 | Week 9-12 | ✅ |
| Phase 5 | Week 13-14 | ✅ |
| Phase 6 | Week 15-16 | ✅ |
| Phase 7 | Week 17-19 | 🔶 |

---

## Milestones

| Milestone | Criteria | Status |
|-----------|----------|--------|
| M1 | Data pipeline functional | ✅ |
| M2 | Query + Risk APIs | ✅ |
| M3 | Demonstrable demo | ✅ |
| M4 | Graph + ML features | ✅ |
| M5 | Alert Service | ✅ |
| M6 | GNN integration | ✅ |
| M7 | Production ready | 🔶 |
