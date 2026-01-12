# Changelog

All notable changes to Chain Risk Platform.

---

## [0.12.0] - 2026-01-12

### Phase 12: SRE & Chaos Engineering

#### Added
- **SLO/SLI Definitions**: Availability and latency targets for all services
- **SLO Dashboard**: Grafana dashboard with availability gauges, error budget, burn rate
- **Toxiproxy Integration**: Fault injection proxy for chaos testing
- **Chaos Scenarios**: 8 fault injection tests (db-latency, db-timeout, db-down, redis-down, kafka-latency, kafka-down, network-jitter, bandwidth-limit)
- **Recovery Verification**: TTD/TTR measurement script
- **Circuit Breaker**: gobreaker implementation for query-service and alert-service
- **Runbooks**: 6 incident response runbooks linked to alerts

#### Changed
- **Alert Rules**: Added SLO alerts and runbook_url annotations

#### Documentation
- `docs/sre/SLO_DEFINITIONS.md`: SLI/SLO reference
- `docs/sre/CHAOS_SCENARIOS.md`: Chaos testing guide
- `docs/sre/runbooks/`: Incident response procedures
- `docs/archive/phase-docs/PHASE12_SUMMARY.md`: Phase summary

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

#### Fixed
- **Prometheus**: Scrape configs now work in Docker network
- **Grafana**: Datasource provisioning with correct Docker hostnames

---

## [0.10.0] - 2026-01-10

### Phase 10: Full Observability Stack

#### Added
- **Grafana Dashboards**: 4 dashboards (infrastructure, services, ML, alerts)
- **Alert Rules**: 15 Prometheus alert rules with severity labels
- **Loki Integration**: Log aggregation with Grafana datasource
- **Jaeger Integration**: Distributed tracing with 7-day retention

---

## [0.9.0] - 2026-01-09

### Phase 9: Alert Service

#### Added
- **Alert Service**: Go service for alert rules and notifications
- **Alert Rules API**: CRUD operations for alert rules
- **Kafka Integration**: Alert event publishing

---

## [0.8.0] - 2026-01-08

### Phase 8: Risk ML Service

#### Added
- **Risk ML Service**: Python FastAPI service for risk scoring
- **ML Models**: Ensemble model with feature extraction
- **Batch Processing**: Bulk address scoring endpoint

---

## [0.7.0] - 2026-01-07

### Phase 7: Graph Service

#### Added
- **Graph Service**: Java Spring Boot service for Neo4j
- **Graph Queries**: Address relationship traversal
- **Tag Propagation**: Risk tag spreading through graph

---

## [0.6.0] - 2026-01-06

### Phase 6: Query Service

#### Added
- **Query Service**: Go Gin service for address queries
- **PostgreSQL Integration**: Address and transaction storage
- **Redis Caching**: Query result caching

---

## [0.5.0] - 2026-01-05

### Phase 5: BFF Service

#### Added
- **BFF Service**: TypeScript NestJS service
- **API Aggregation**: Multi-service response composition
- **Request Validation**: DTO validation with class-validator

---

## [0.4.0] - 2026-01-04

### Phase 4: Orchestrator

#### Added
- **Orchestrator**: Java Spring Cloud Gateway
- **JWT Authentication**: Token validation middleware
- **Rate Limiting**: Per-client request throttling

---

## [0.3.0] - 2026-01-03

### Phase 3: Data Pipeline

#### Added
- **Kafka Setup**: Message broker configuration
- **Flink Jobs**: Stream processing stubs
- **Hudi Integration**: Data lake archival

---

## [0.2.0] - 2026-01-02

### Phase 2: Infrastructure

#### Added
- **Docker Compose**: Multi-service orchestration
- **PostgreSQL**: Primary database
- **Redis**: Caching layer
- **Neo4j**: Graph database

---

## [0.1.0] - 2026-01-01

### Phase 1: Project Foundation

#### Added
- **Repository Setup**: Monorepo structure
- **Documentation**: Architecture docs, roadmap
- **Makefile**: Development commands

---

**Maintained by**: Chain Risk Platform Team
