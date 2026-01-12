# Changelog

All notable changes to Chain Risk Platform.

---

## [0.15.0] - 2026-01-12

### Phase 15: Performance Testing

#### Added
- **k6 Performance Tests**: Baseline, sustained, ramp, mixed workload, DB stress scenarios
- **Baseline Report**: Comprehensive performance metrics for all services

#### Results
- All services meet SLA targets
- Query Service P95: 112ms (<200ms)
- Risk ML Service P95: 312ms (<500ms)
- Alert Service P95: 134ms (<200ms)
- Graph Service P95: 198ms (<300ms)
- Overall Error Rate: 0.45% (<1%)

#### Files
- `tests/api/performance/*.test.js`: Test scenarios
- `docs/performance/BASELINE_REPORT.md`: Full report
- `docs/archive/phase-docs/PHASE15_SUMMARY.md`: Phase summary

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

---

## [0.12.0] - 2026-01-12

### Phase 12: SRE & Chaos Engineering

#### Added
- **SLO/SLI Definitions**: Availability and latency targets for all services
- **SLO Dashboard**: Grafana dashboard with availability gauges, error budget, burn rate
- **Toxiproxy Integration**: Fault injection proxy for chaos testing
- **Chaos Scenarios**: 8 fault injection tests
- **Recovery Verification**: TTD/TTR measurement script
- **Circuit Breaker**: gobreaker implementation for query-service and alert-service
- **Runbooks**: 6 incident response runbooks

#### Files
- `docs/sre/SLO_DEFINITIONS.md`: SLI/SLO reference
- `docs/sre/CHAOS_SCENARIOS.md`: Chaos testing guide
- `docs/sre/runbooks/`: Incident response procedures
- `infra/compose/chaos.yml`: Toxiproxy compose
- `tests/chaos/`: Chaos test scripts
- `services/*/pkg/circuitbreaker/`: Circuit breaker implementation

---

## [0.11.0] - 2026-01-12

### Phase 11: API Integration Testing

#### Added
- **k6 Testing Framework**: Contract, functional, and performance tests
- **Contract Tests**: 5 services, 123+ checks validating OpenAPI compliance
- **Unit Tests**: GraphControllerTest (17), alert_rule_handler_test (13)

#### Fixed
- **graph-service**: Validation errors return 400 (was 500)
- **graph-service**: POST /tags handles new addresses correctly
- **alert-service**: Severity filter works in ListRules endpoint

---

## [0.10.6] - 2026-01-11

### Fixed
- Kafka stale cluster ID on volume recreation
- alert-service docker config mount
- graph-service/orchestrator NACOS_SERVER env
- orchestrator REDIS_HOST/PORT env
- BFF external port 3001→3401

---

## [0.10.0] - 2026-01-11

### Phase 10: Production Hardening

#### Added
- Observability Stack: Prometheus, Grafana, Loki, Jaeger
- Service Dashboards
- Log Aggregation
- Distributed Tracing

---

## [0.9.0] - 2026-01-10

### Phase 9: Graph Service
- Neo4j Integration
- Graph queries and path finding

---

## [0.8.0] - 2026-01-09

### Phase 8: Alert Service
- Alert rules and notifications

---

## [0.7.0] - 2026-01-08

### Phase 7: Risk ML Service
- ML scoring and feature engineering

---

## [0.6.0] - 2026-01-07

### Phase 6: Query Service
- Address query API

---

## [0.5.0] - 2026-01-06

### Phase 5: BFF Gateway
- NestJS BFF layer

---

## [0.4.0] - 2026-01-05

### Phase 4: Orchestrator
- Spring Gateway with JWT auth

---

## [0.3.0] - 2026-01-04

### Phase 3: Data Processing
- Kafka Streams and Flink jobs

---

## [0.2.0] - 2026-01-03

### Phase 2: Data Ingestion
- Blockchain connectors

---

## [0.1.0] - 2026-01-02

### Phase 1: Foundation
- Project structure and infrastructure
