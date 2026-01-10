# Phase 7: Production Readiness Roadmap

> Detailed development plan with checkpoint dependencies (DAG)

**Created**: 2026-01-09

---

## Overview

Phase 7 focuses on production readiness: integration testing infrastructure, E2E validation, deployment, and monitoring.

### Goals
1. Complete GNN E2E validation
2. Implement Data Generator for continuous testing
3. Set up rolling data cleanup
4. K8s deployment
5. Monitoring stack (Prometheus + Grafana)

---

## Checkpoint Dependency Graph (DAG)

```
                                    ┌─────────────────────┐
                                    │   CP-1: Infra       │
                                    │   Remote Verify     │
                                    └──────────┬──────────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         │                     │                     │
                         ▼                     ▼                     ▼
               ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
               │   CP-2: Data    │   │   CP-3: Rolling │   │   CP-4: Metrics │
               │   Generator     │   │   Cleanup       │   │   Export        │
               └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
                        │                     │                     │
                        └──────────┬──────────┘                     │
                                   │                                │
                                   ▼                                │
                         ┌─────────────────┐                        │
                         │   CP-5: E2E     │                        │
                         │   Test Suite    │                        │
                         └────────┬────────┘                        │
                                  │                                 │
                                  ├─────────────────────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   CP-6: GNN     │
                         │   E2E Tests     │
                         └────────┬────────┘
                                  │
                                  ▼
           ┌──────────────────────┴──────────────────────┐
           │                                             │
           ▼                                             ▼
 ┌─────────────────┐                           ┌─────────────────┐
 │   CP-7: K8s     │                           │   CP-8: Grafana │
 │   Manifests     │                           │   Dashboards    │
 └────────┬────────┘                           └────────┬────────┘
          │                                             │
          └──────────────────────┬──────────────────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │   CP-9: Staging │
                       │   Deployment    │
                       └─────────────────┘
```

---

## Checkpoints

### CP-1: Remote Infrastructure Verification

**Dependencies**: None  
**Estimated**: 0.5 day

| Task | Description                                            |
| ---- | ------------------------------------------------------ |
| 1.1  | Verify WSL docker-compose services up                  |
| 1.2  | Test connectivity from macOS via `make infra-check`    |
| 1.3  | Validate all ports accessible (Kafka, PG, Neo4j, etc.) |

**Acceptance Criteria**:
- `make infra-check` passes all checks
- All UI tools accessible (Grafana, Jaeger, Kafka-UI)

---

### CP-2: Data Generator

**Dependencies**: CP-1  
**Estimated**: 2 days

| Task | Description                                              |
| ---- | -------------------------------------------------------- |
| 2.1  | Add generator mode to data-ingestion                     |
| 2.2  | Implement scenario loader (JSON configs)                 |
| 2.3  | Implement random transaction generator                   |
| 2.4  | Add speed control (TPS, ratio)                           |
| 2.5  | Create scenario files (normal, high_risk, whale, stress) |
| 2.6  | Add Makefile targets                                     |

**Files**:
```
data-ingestion/
├── cmd/
│   └── generator/main.go          # New entry point
├── internal/
│   └── generator/
│       ├── generator.go           # Core generator logic
│       ├── scenario.go            # Scenario loader
│       └── random.go              # Random generator
└── configs/
    └── scenarios/
        ├── normal_traffic.json
        ├── high_risk_cluster.json
        ├── whale_movement.json
        └── stress_test.json
```

**Acceptance Criteria**:
- `make generator-run MODE=scenario` produces Kafka messages
- Configurable TPS (1-1000)
- Scenario playback works

---

### CP-3: Rolling Data Cleanup

**Dependencies**: CP-1  
**Estimated**: 1.5 days

| Task | Description                         |
| ---- | ----------------------------------- |
| 3.1  | PostgreSQL: Add partition migration |
| 3.2  | PostgreSQL: Create cleanup function |
| 3.3  | Neo4j: Add TTL properties to nodes  |
| 3.4  | Neo4j: Create cleanup Cypher script |
| 3.5  | Create unified cleanup cron script  |
| 3.6  | Add Makefile target                 |

**Files**:
```
scripts/
├── db/
│   ├── pg-partition-setup.sql
│   ├── pg-cleanup.sql
│   └── neo4j-cleanup.cypher
└── cleanup-cron.sh
```

**Acceptance Criteria**:
- `make cleanup-rolling` cleans data older than retention period
- Partitions created/dropped automatically
- Neo4j nodes with TTL cleaned

---

### CP-4: Service Metrics Export

**Dependencies**: CP-1  
**Estimated**: 1 day

| Task | Description                           |
| ---- | ------------------------------------- |
| 4.1  | Query Service: Add Prometheus metrics |
| 4.2  | Alert Service: Add Prometheus metrics |
| 4.3  | Risk Service: Verify metrics export   |
| 4.4  | Graph Service: Verify metrics export  |
| 4.5  | Update Prometheus targets config      |

**Metrics per Service**:
- Request count, latency histogram
- Error rate
- Service-specific (alerts triggered, risk scores computed, etc.)

**Acceptance Criteria**:
- All services expose `/metrics` endpoint
- Prometheus scrapes all targets
- Metrics visible in Prometheus UI

---

### CP-5: E2E Test Suite

**Dependencies**: CP-2, CP-3  
**Estimated**: 2 days

| Task | Description                                              |
| ---- | -------------------------------------------------------- |
| 5.1  | Create E2E test framework                                |
| 5.2  | Implement pipeline test (Ingestion → Kafka → Flink → DB) |
| 5.3  | Implement service test (Query, Risk, Graph, Alert)       |
| 5.4  | Implement BFF API test                                   |
| 5.5  | Add test data validation                                 |
| 5.6  | Add Makefile target                                      |

**Files**:
```
tests/e2e/
├── framework/
│   ├── setup.go
│   ├── teardown.go
│   └── assertions.go
├── pipeline_test.go
├── services_test.go
├── bff_test.go
└── run_e2e.sh
```

**Acceptance Criteria**:
- `make test-e2e` runs full pipeline test
- Tests use Data Generator for input
- Tests verify data propagation through all stages

---

### CP-6: GNN E2E Tests

**Dependencies**: CP-5  
**Estimated**: 1.5 days

| Task | Description                           |
| ---- | ------------------------------------- |
| 6.1  | Create GNN test scenarios             |
| 6.2  | Implement feature extraction E2E test |
| 6.3  | Implement GNN inference E2E test      |
| 6.4  | Implement ensemble scoring E2E test   |
| 6.5  | Validate against known risk patterns  |

**Files**:
```
tests/e2e/
├── gnn/
│   ├── feature_extraction_test.go
│   ├── gnn_inference_test.go
│   └── ensemble_test.go
└── fixtures/
    └── gnn/
        ├── known_high_risk.json
        └── known_low_risk.json
```

**Acceptance Criteria**:
- GNN correctly identifies known high-risk patterns
- Ensemble model improves over XGBoost-only baseline
- Latency within acceptable bounds (<500ms)

---

### CP-7: K8s Manifests

**Dependencies**: CP-6  
**Estimated**: 2 days

| Task | Description                                            |
| ---- | ------------------------------------------------------ |
| 7.1  | Create base manifests (namespace, configmaps, secrets) |
| 7.2  | Create Deployment + Service for each service           |
| 7.3  | Create Ingress configuration                           |
| 7.4  | Create HPA (Horizontal Pod Autoscaler)                 |
| 7.5  | Create Kustomize overlays (dev, staging, prod)         |
| 7.6  | Document deployment procedure                          |

**Files**:
```
infra/k8s/
├── base/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── query-service/
│   ├── risk-service/
│   ├── alert-service/
│   ├── graph-service/
│   ├── bff/
│   └── orchestrator/
├── overlays/
│   ├── dev/
│   ├── staging/
│   └── prod/
└── kustomization.yaml
```

**Acceptance Criteria**:
- `kubectl apply -k infra/k8s/overlays/dev` deploys all services
- Services communicate via K8s DNS
- Health checks passing

---

### CP-8: Grafana Dashboards

**Dependencies**: CP-4, CP-6  
**Estimated**: 1.5 days

| Task | Description                         |
| ---- | ----------------------------------- |
| 8.1  | Create Pipeline Overview dashboard  |
| 8.2  | Create Service Health dashboard     |
| 8.3  | Create Alert Metrics dashboard      |
| 8.4  | Create GNN/ML Performance dashboard |
| 8.5  | Set up alerting rules               |

**Files**:
```
infra/grafana/
├── provisioning/
│   ├── dashboards/
│   │   ├── pipeline-overview.json
│   │   ├── service-health.json
│   │   ├── alert-metrics.json
│   │   └── ml-performance.json
│   └── alerting/
│       └── rules.yaml
└── grafana.ini
```

**Acceptance Criteria**:
- Dashboards auto-provisioned on Grafana start
- Key metrics visualized (throughput, latency, errors)
- Alerts fire on threshold breach

---

### CP-9: Staging Deployment

**Dependencies**: CP-7, CP-8  
**Estimated**: 1 day

| Task | Description                   |
| ---- | ----------------------------- |
| 9.1  | Deploy to staging K8s cluster |
| 9.2  | Run E2E tests against staging |
| 9.3  | Verify monitoring stack       |
| 9.4  | Load test (optional)          |
| 9.5  | Document runbook              |

**Acceptance Criteria**:
- All services running in staging
- E2E tests pass against staging
- Grafana dashboards populated
- Runbook documented

---

## Summary Table

| CP  | Name                | Dependencies | Days | Priority |
| --- | ------------------- | ------------ | ---- | -------- |
| 1   | Remote Infra Verify | -            | 0.5  | High     |
| 2   | Data Generator      | 1            | 2    | High     |
| 3   | Rolling Cleanup     | 1            | 1.5  | High     |
| 4   | Metrics Export      | 1            | 1    | Medium   |
| 5   | E2E Test Suite      | 2, 3         | 2    | High     |
| 6   | GNN E2E Tests       | 5            | 1.5  | High     |
| 7   | K8s Manifests       | 6            | 2    | Medium   |
| 8   | Grafana Dashboards  | 4, 6         | 1.5  | Medium   |
| 9   | Staging Deploy      | 7, 8         | 1    | Low      |

**Total Estimated**: ~13 days

---

## Execution Order (Topological Sort)

Based on DAG dependencies:

| Worker | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 | Stage 6 |
| ------ | ------- | ------- | ------- | ------- | ------- | ------- |
| 1      | CP-1    | CP-2    | CP-5    | CP-6    | CP-7    | CP-9    |
| 2      |         | CP-3    |         |         | CP-8    |         |
| 3      |         | CP-4    |         |         |         |         |

---

## Risk Mitigation

| Risk                             | Mitigation                               |
| -------------------------------- | ---------------------------------------- |
| Remote infra connectivity issues | Fallback to local docker-compose         |
| GNN E2E performance issues       | Add timeout handling, batch processing   |
| K8s resource constraints         | Start with minimal replicas, scale later |

---

## Success Criteria

Phase 7 complete when:
- [ ] GNN E2E tests passing
- [ ] Data Generator operational
- [ ] Rolling cleanup configured
- [ ] All services deployed to staging K8s
- [ ] Grafana dashboards functional
- [ ] E2E tests pass against staging
