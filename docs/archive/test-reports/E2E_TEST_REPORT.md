# E2E Test Report

**Date**: 2026-01-09  
**Result**: ✅ All Passed

---

## Test Suites

### BFF (`bff_test.go`)

| Test | Endpoints |
|------|-----------|
| Health | `/health` |
| AddressAPI | `/api/addresses/:addr`, `/risk`, `/transactions`, `/graph` |
| AlertAPI | `/api/alerts/rules`, `/history`, `/stats`, `/subscriptions` |
| RiskAPI | `/api/risk/batch`, `/api/risk/rules` |
| GraphAPI | `/api/graph/address/:addr`, `/neighbors`, `/search/high-risk` |
| CORS | OPTIONS preflight |

### Services (`services_test.go`)

| Service | Endpoints |
|---------|-----------|
| Query | `/health`, `/api/v1/addresses/:addr`, `/api/v1/transactions`, `/metrics` |
| Risk | `/health`, `/api/v1/risk/:addr`, `/docs` |
| Graph | `/actuator/health`, `/api/v1/graph/neighbors`, `/api/v1/graph/subgraph` |
| Alert | `/health`, `/api/v1/alerts`, `/api/v1/rules` |

### Pipeline (`pipeline_test.go`)

| Test | Coverage |
|------|----------|
| IngestionToDatabase | Kafka → Flink → PostgreSQL |
| KafkaMessageFormat | Topic metadata |
| DatabaseSchema | `chain_data.transfers`, `transactions`, `processing_state` |
| Neo4jConnectivity | Driver connection |

### GNN (`gnn/`)

| Test | Coverage |
|------|----------|
| FeatureExtraction | Feature pipeline |
| GNNInference | Model endpoint |
| Ensemble | Multi-model scoring |
| Validation | Risk patterns, score distribution, latency (<500ms) |

---

## Run

```bash
./tests/e2e/run_e2e.sh [all|pipeline|services|bff|gnn]
```
