# Changelog

All notable changes to Chain Risk Platform.

---

## [0.10.0] - 2026-01-11

### Phase 10: Production Hardening

#### Added
- **Containerization**: All 6 services Dockerized with multi-stage builds
- **Vault Integration**: HashiCorp Vault for secrets management
- **Elasticsearch**: Persistent storage for Jaeger traces
- **ILM Policy**: 7-day trace retention with automatic cleanup
- **WebSocket**: Real-time alert push via Socket.IO
- **Grafana Dashboards**: Infrastructure overview, service health, ML performance
- **Smoke Test**: Service verification and trace generation script
- **Validation Script**: 23-point Phase 10 validation

#### Infrastructure
- Modular Docker Compose: base, infra, monitoring, security, services
- Modular Makefile: docker, services, observability, testing
- Network isolation: chainrisk-backend, chainrisk-monitoring

#### Security
- Vault secrets for databases, JWT, API keys
- AppRole authentication for services
- RBAC implementation in BFF/Orchestrator

#### Monitoring
- Prometheus metrics collection
- Grafana dashboards (5 dashboards)
- Loki log aggregation
- Jaeger distributed tracing with ES backend

---

## [0.9.0] - 2026-01-10

### Phase 9: Batch Orchestration
- Airflow integration with DAGs
- Daily archive pipeline
- Daily ML feature/training pipeline
- Weekly label update pipeline

---

## [0.8.0] - 2026-01-10

### Phase 8: Observability Stack
- Loki log aggregation
- Promtail log collection
- Python/Java OTel integration
- Unified observability dashboard
- 15 alert rules

---

## [0.7.0] - 2026-01-10

### Phase 7: Production Readiness
- Remote infrastructure verification
- Data generator with scenarios
- Rolling data cleanup
- E2E test suite
- K8s manifests

---

## [0.6.0] - 2026-01-09

### Phase 6: ML with GNN
- GraphSAGE/GAT model architecture
- Training pipeline
- Ensemble model (XGBoost + GNN)

---

## [0.5.0] - 2026-01-09

### Phase 5: Alert Service
- Kafka consumer for risk-scores, transfers
- Alert engine with 6 rule types
- Multi-channel notifications (Webhook, Email, Slack)

---

## [0.4.0] - Previous

### Phase 4: Advanced Features
- Graph Service with Neo4j
- ML Risk Model (XGBoost, Isolation Forest)
- Batch processing jobs

---

## [0.3.0] - Previous

### Phase 3: BFF & Frontend
- BFF (NestJS) API aggregation
- React frontend with dashboard
- Dark mode support

---

## [0.2.0] - Previous

### Phase 2: Query & Risk Services
- Query Service (Go/Gin)
- Risk Service (Python/FastAPI)
- Orchestrator (Spring Cloud Gateway)
- Nacos service discovery

---

## [0.1.0] - Previous

### Phase 1: Core Data Flow
- Data Ingestion (Go) - Etherscan API
- Stream Processor (Flink)
- Kafka, PostgreSQL, Redis infrastructure
