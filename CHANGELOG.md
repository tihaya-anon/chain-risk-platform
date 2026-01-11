# Changelog

All notable changes to Chain Risk Platform.

---

## [0.10.6] - 2026-01-11

### Fixed
- **Kafka**: Clear stale cluster ID on volume recreation
- **alert-service**: Mount docker config file for proper DB connection
- **graph-service/orchestrator**: Add NACOS_SERVER environment variable
- **orchestrator**: Add REDIS_HOST/PORT environment variables
- **BFF**: Change external port 3001→3401 (Windows Hyper-V port exclusion)

### Changed
- Updated PHASE10_AI_CONTEXT.md with correct port reference
- Recommend using git push/pull instead of rsync for code sync

---

## [0.10.5] - 2026-01-11

### Phase 10.5: Observability & E2E Testing

#### Added
- **Prometheus**: Updated targets to use Docker service names
- **Java OTel**: Added OpenTelemetry agent to graph-service/orchestrator
- **Integration Test**: Cross-service trace validation script
- **Playwright E2E**: Frontend test framework with 5 specs
- **WebSocket E2E**: Real-time alert push testing

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
- Prometheus metrics collection
- Grafana dashboards
- Loki log aggregation
- Jaeger distributed tracing
- OpenTelemetry integration

---

## [0.7.0] - 2026-01-10

### Phase 7: Kubernetes Deployment
- K8s manifests for all services
- Kustomize overlays (dev, staging, prod)
- HPA configurations
- Helm-ready structure

---

## [0.6.0] - 2026-01-09

### Phase 6: GNN Integration
- Graph Neural Network for risk scoring
- Neo4j integration
- GraphSAGE model training
- Batch inference pipeline

---

## [0.5.0] - 2026-01-09

### Phase 5: Alert Service
- Rule-based alerting engine
- Multiple notification channels
- Alert deduplication
- Kafka consumer for real-time events

---

## [0.4.0] - 2026-01-08

### Phase 4: Lambda Architecture
- Batch layer with Hudi tables
- Speed layer with Flink
- Serving layer with Trino

---

## [0.3.0] - 2026-01-07

### Phase 3: ML Pipeline
- Risk scoring models
- Feature engineering
- Model serving API

---

## [0.2.0] - 2026-01-06

### Phase 2: Data Ingestion
- Etherscan API integration
- Kafka event streaming
- PostgreSQL storage

---

## [0.1.0] - 2026-01-05

### Phase 1: Foundation
- Project structure
- Core services skeleton
- Basic API endpoints
