# Changelog

All notable changes to Chain Risk Platform.

---

## [0.14.0] - 2026-01-12

### Phase 14: CI/CD Pipeline

#### Added
- **GitHub Actions CI**: Lint, build, test workflows for monorepo
- **Build Pipeline**: Docker image build with caching and SBOM
- **Test Automation**: Unit, integration, contract test workflows
- **Registry Cleanup**: Weekly cleanup of old container images
- **Dependabot**: Automated dependency updates
- **Blue-Green Deploy**: Zero-downtime deployment script
- **Rollback Script**: Quick rollback with history tracking

#### Files
- `.github/workflows/ci.yml`: CI pipeline
- `.github/workflows/build.yml`: Docker build
- `.github/workflows/test.yml`: Test automation
- `.github/workflows/cleanup.yml`: Image cleanup
- `.github/dependabot.yml`: Dependency updates
- `scripts/deploy/blue-green.sh`: Deployment script
- `scripts/deploy/rollback.sh`: Rollback script
- `scripts/wait-for-healthy.sh`: Health check script

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
- **Observability Stack**: Prometheus, Grafana, Loki, Jaeger
- **Service Dashboards**: Per-service Grafana dashboards
- **Log Aggregation**: Centralized logging with Loki
- **Distributed Tracing**: Jaeger integration

---

## [0.9.0] - 2026-01-10

### Phase 9: Graph Service

#### Added
- **Neo4j Integration**: Graph database for address relationships
- **Graph Queries**: Path finding and risk propagation

---

## [0.8.0] - 2026-01-09

### Phase 8: Alert Service

#### Added
- **Alert Rules**: Configurable risk thresholds
- **Notification System**: Multi-channel alerts

---

## [0.7.0] - 2026-01-08

### Phase 7: Risk ML Service

#### Added
- **ML Scoring**: Risk assessment models
- **Feature Engineering**: Address behavior features

---

## [0.6.0] - 2026-01-07

### Phase 6: Query Service

#### Added
- **Address Query API**: Blockchain address lookups
- **Transaction History**: Historical data retrieval

---

## [0.5.0] - 2026-01-06

### Phase 5: BFF Gateway

#### Added
- **NestJS BFF**: Business aggregation layer
- **API Composition**: Multi-service orchestration

---

## [0.4.0] - 2026-01-05

### Phase 4: Orchestrator

#### Added
- **Spring Gateway**: API gateway with JWT auth
- **Rate Limiting**: Request throttling

---

## [0.3.0] - 2026-01-04

### Phase 3: Data Processing

#### Added
- **Kafka Streams**: Real-time data processing
- **Flink Jobs**: Batch analytics

---

## [0.2.0] - 2026-01-03

### Phase 2: Data Ingestion

#### Added
- **Blockchain Connectors**: Multi-chain data ingestion
- **Kafka Producers**: Event streaming

---

## [0.1.0] - 2026-01-02

### Phase 1: Foundation

#### Added
- **Project Structure**: Monorepo layout
- **Docker Compose**: Local development environment
- **Infrastructure**: PostgreSQL, Redis, Kafka setup
