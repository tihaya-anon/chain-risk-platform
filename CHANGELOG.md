# Changelog

All notable changes to Chain Risk Platform.

---

## [0.11.0] - 2026-01-12

### Phase 11: API Integration Testing

#### Added
- **k6 Testing Framework**: Contract, functional, and performance tests
- **Contract Tests**: 5 services, 123+ checks validating OpenAPI compliance
- **Unit Tests**: GraphControllerTest (17), alert_rule_handler_test (13)

#### Fixed
- **graph-service**: Validation errors now return 400 (was 500)
- **graph-service**: POST /tags handles new addresses correctly
- **alert-service**: Severity filter now works in ListRules endpoint

#### Documentation
- `tests/api/README.md`: Testing framework guide
- `docs/handover/phase11-fix-plan.md`: Fix plan and verification
- `docs/archive/phase-docs/PHASE11_SUMMARY.md`: Phase summary

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
- Unified secret management with environment variables
- Health checks and restart policies

---

## [0.9.0] - 2026-01-10

### Phase 9: Stream Processing & ML Pipeline

#### Added
- **stream-processor**: Flink-based real-time transaction analysis
- **batch-processor**: Feature extraction and model training pipelines
- **ML Model Registry**: Version-controlled model storage
- **Feature Store**: Centralized feature management

---

## [0.8.0] - 2026-01-09

### Phase 8: Observability Foundation

#### Added
- **Jaeger**: Distributed tracing
- **Prometheus + Grafana**: Metrics collection and visualization
- **Loki**: Log aggregation
- **OpenTelemetry**: Instrumentation for Go and Java services

---

## [0.7.0] - 2026-01-08

### Phase 7: Frontend & BFF

#### Added
- **BFF Service**: Backend-for-frontend aggregation layer
- **React Dashboard**: Risk monitoring and alert management UI
- **WebSocket**: Real-time updates

---

## [0.6.0] - 2026-01-07

### Phase 6: Orchestration

#### Added
- **orchestrator**: Service coordination and workflow management
- **Saga Pattern**: Distributed transaction handling
- **Circuit Breaker**: Resilience patterns with Resilience4j

---

## [0.5.0] - 2026-01-06

### Phase 5: Alert System

#### Added
- **alert-service**: Rule-based alerting engine
- **Notification Channels**: Email, Slack, webhook support
- **Alert Rules**: Configurable thresholds and conditions

---

## [0.4.0] - 2026-01-05

### Phase 4: Graph Analytics

#### Added
- **graph-service**: Neo4j-based address relationship tracking
- **Tag Propagation**: BFS-based risk tag spreading
- **Clustering**: Address clustering algorithms

---

## [0.3.0] - 2026-01-04

### Phase 3: Risk ML Service

#### Added
- **risk-ml-service**: Machine learning risk scoring
- **Feature Engineering**: Transaction pattern features
- **Model Serving**: Real-time prediction API

---

## [0.2.0] - 2026-01-03

### Phase 2: Query Service

#### Added
- **query-service**: Transaction data query API
- **PostgreSQL**: Timeseries storage with partitioning
- **Redis**: Query result caching

---

## [0.1.0] - 2026-01-02

### Phase 1: Data Ingestion

#### Added
- **data-ingestion**: Etherscan API polling
- **Kafka**: Event streaming infrastructure
- **Nacos**: Service discovery and configuration
