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

## Phase 3: BFF & Frontend ✅ Complete (90%)

**Goal**: Demonstrable product

- [x] BFF (TypeScript/NestJS) - API aggregation, Gateway trust mode
- [x] Frontend (React) - Dashboard, Address, Risk, Graph pages
- [ ] K8s deployment
- [ ] Monitoring (Prometheus + Grafana)

---

## Phase 4: Advanced Features ✅ Complete (90%)

**Goal**: Core competitive features

### 4.1 Graph Service ✅ Complete
- [x] Neo4j integration
- [x] Address clustering (Union-Find)
- [x] Tag propagation (BFS)
- [x] Graph query API
- [x] Refactored: Moved to `services/graph-service`, Flink dual-write

### 4.2 ML Risk Model ✅ Complete
- [x] Feature pipeline (Spark batch jobs)
- [x] Label ingestion (OFAC, Tornado Cash, Exchange)
- [x] Training data preparation
- [x] **XGBoost model training**
- [x] **Isolation Forest training**
- [x] **GNN (GraphSAGE) training**
- [x] **Model registry (MinIO)**
- [x] **Unified training pipeline**

### 4.3 Batch Processing ✅ Complete
- [x] Archive job (PostgreSQL → Hudi)
- [x] Correction job (risk scoring)
- [x] Feature compute job
- [x] Unified script: `./scripts/run-batch-processor.sh <job>`

### 4.4 Alert Service 🔶 In Progress (separate branch)
- [ ] Alert rule engine
- [ ] Multi-channel notification

---

## Timeline

```
Week 1-3:   Phase 1 - Core Data Flow ✅
Week 4-6:   Phase 2 - Query & Risk Services ✅
Week 7-8:   Phase 3 - BFF & Frontend ✅ (90%)
Week 9+:    Phase 4 - Advanced Features ✅ (90%)
```

---

## Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| M1 | Data ingestion → DB | ✅ |
| M2 | Query API + Risk scoring | ✅ |
| M3 | Demonstrable demo | ✅ |
| M4 | Graph + ML features | ✅ |

---

## Recent Updates

### 2026-01-09
- ✅ ML Training Pipeline Complete
  - XGBoost, Isolation Forest, GNN all trained
  - Models uploaded to MinIO registry
  - Unified `train_all.py` script

### 2026-01-06
- ✅ Graph Service refactoring
- ✅ ML Feature Pipeline (Spark jobs)

---

## Related Documentation

- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
- [GNN Development Plan](./GNN_DEVELOPMENT_PLAN.md)
- [Project Overview](../architecture/PROJECT_OVERVIEW.md)
