# Chain Risk Platform - Development Plan

## MVP Phases

---

## Phase 1: Core Data Flow ✅ Complete

**Goal**: Chain data → Kafka → Flink → DB pipeline

### Completed
- [x] Docker Compose (Kafka, PostgreSQL, Redis)
- [x] Data Ingestion (Go) - Etherscan API, Kafka Producer
- [x] Stream Processor (Flink) - Kafka Consumer, PostgreSQL Sink
- [x] Integration Test Framework - Mock Server, Fixtures

---

## Phase 2: Query & Risk Services ✅ Complete (85%)

**Goal**: Basic query API and risk scoring

### Completed
- [x] Query Service (Go/Gin) - Address/transfer queries, Redis cache
- [x] Risk Service (Python/FastAPI) - Rule-based scoring
- [x] Orchestrator (Java/Spring Cloud Gateway) - Auth, routing, rate limiting
- [x] Nacos integration - All services

---

## Phase 3: BFF & Frontend 🔶 In Progress (80%)

**Goal**: Demonstrable product

### Completed
- [x] BFF (TypeScript/NestJS) - API aggregation, Gateway trust mode
- [x] Frontend (React) - Dashboard, Address, Risk, Graph pages

### Pending
- [ ] K8s deployment
- [ ] Monitoring (Prometheus + Grafana)

---

## Phase 4: Advanced Features 🔶 In Progress (50%)

**Goal**: Core competitive features

### 4.1 Graph Service ✅ Complete
- [x] Neo4j integration
- [x] Address clustering (Union-Find)
- [x] Tag propagation (BFS)
- [x] Graph query API
- [x] **Refactored**: Moved to `services/graph-service`, removed deprecated sync layer

**Architecture Change (2026-01-06)**:
```
Before: Flink → PostgreSQL → GraphSyncService → Neo4j
After:  Flink → PostgreSQL + Neo4j (dual-write)
```

### 4.2 ML Risk Model 🔶 In Progress
- [x] Feature pipeline (Spark batch jobs)
- [x] Label ingestion (OFAC, Tornado Cash, Exchange)
- [x] Training data preparation
- [ ] XGBoost model training
- [ ] Model serving

### 4.3 Batch Processing ✅ Complete
- [x] Archive job (PostgreSQL → Hudi)
- [x] Correction job (risk scoring)
- [x] Feature compute job
- [x] Unified script: `./scripts/run-batch-processor.sh <job>`

### 4.4 Alert Service ⏳ Not Started
- [ ] Alert rule engine
- [ ] Multi-channel notification

---

## Timeline

```
Week 1-3:   Phase 1 - Core Data Flow ✅
Week 4-6:   Phase 2 - Query & Risk Services ✅
Week 7-8:   Phase 3 - BFF & Frontend 🔶 (80%)
Week 9+:    Phase 4 - Advanced Features 🔶 (50%)
```

---

## Milestones

| Milestone | Target | Criteria | Status |
|-----------|--------|----------|--------|
| M1 | Week 3 | Data ingestion → DB | ✅ |
| M2 | Week 6 | Query API + Risk scoring | ✅ |
| M3 | Week 8 | Demonstrable demo | 🔶 80% |
| M4 | Week 12 | Graph + ML features | 🔶 Graph ✅, ML in progress |

---

## Recent Updates

### 2026-01-06
- ✅ Graph Service refactoring
  - Moved `processing/graph-engine` → `services/graph-service`
  - Removed deprecated PostgreSQL → Neo4j sync
  - Data now via Flink dual-write
  - Updated BFF, Nacos config, documentation

### 2026-01-05
- ✅ ML Feature Pipeline
  - FeatureComputeJob, LabelIngestionJob, TrainingDataPrepareJob
  - Unified batch script

### 2026-01-02
- ✅ Integration test framework
- ✅ Data ingestion refactoring
- ✅ Nacos integration

---

## Related Documentation

- [Development Status](./DEVELOPMENT_STATUS.md)
- [Project Overview](../architecture/PROJECT_OVERVIEW.md)
- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
