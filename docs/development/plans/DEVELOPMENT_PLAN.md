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

## Phase 7: Production Readiness ✅

**Completed**: 2026-01-10

- [x] Remote infrastructure verification
- [x] Data generator with scenario support
- [x] Rolling data cleanup (PostgreSQL, Neo4j)
- [x] Service metrics export (Prometheus)
- [x] E2E test suite
- [x] GNN E2E tests
- [x] K8s manifests (base + overlays)
- [x] Grafana dashboards

---

## Phase 8: Observability Stack ✅

**Completed**: 2026-01-10

- [x] Loki log aggregation (7-day retention)
- [x] Promtail log collection (Docker containers)
- [x] Grafana datasources (Loki, Jaeger, Prometheus)
- [x] Python OTel SDK with trace export
- [x] Java OTel Agent configuration
- [x] Unified observability dashboard
- [x] Enhanced alert rules (15 rules)
- [x] Integration test validated

See [OBSERVABILITY_PHASE8_VALIDATION.md](../guides/OBSERVABILITY_PHASE8_VALIDATION.md) for validation report.

---

## Phase 9: Batch Orchestration ✅

**Completed**: 2026-01-10

- [x] Airflow integration with DAGs
- [x] `chain_risk_archive` - Daily archive pipeline (02:00 UTC)
- [x] `chain_risk_ml` - Daily ML feature/training (04:00 UTC)
- [x] `chain_risk_labels` - Weekly label update (Sunday 01:00 UTC)
- [x] ExternalTaskSensor for DAG dependencies

See [infra/airflow/README.md](../../../infra/airflow/README.md) for details.

---

## Timeline Summary

| Phase | Content | Status |
|-------|---------|--------|
| Phase 1-2 | Core Data Flow, Query & Risk | ✅ |
| Phase 3 | BFF & Frontend | ✅ |
| Phase 4 | Graph + ML Features | ✅ |
| Phase 5 | Alert Service | ✅ |
| Phase 6 | GNN Integration | ✅ |
| Phase 7 | Production Readiness | ✅ |
| Phase 8 | Observability Stack | ✅ |
| Phase 9 | Batch Orchestration | ✅ |

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
| M7 | Production ready | ✅ |
| M8 | Full observability | ✅ |
| M9 | Automated batch jobs | ✅ |

---

## Future Enhancements (Backlog)

| Feature | Priority | Description |
|---------|----------|-------------|
| Security Hardening | High | JWT/OAuth, Vault integration, audit logs |
| Service Containerization | High | Run services in Docker for full log correlation |
| Jaeger Persistent Storage | Medium | Elasticsearch backend for trace retention |
| WebSocket Real-time Alerts | Medium | Push alerts to frontend via WebSocket |
| Multi-chain Support | Medium | Expand beyond Ethereum |
| Report Export | Low | PDF/CSV export for compliance |
| User Management UI | Low | Admin interface for user/role management |
