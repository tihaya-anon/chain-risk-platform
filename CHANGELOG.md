# Changelog

All notable changes to Chain Risk Platform.

---

## [0.18.0] - 2026-01-14

### Phase 17: AIOps Foundation

#### Added
- **OTel Data Lake**: Kafka export + Spark archive to Hudi for ML training
- **USE Method Metrics**: Utilization/Saturation/Errors for all services
- **Load Generator**: Go-based load generator with multiple arrival patterns
- **Capacity Modeling**: Little's Law validation + USL curve fitting tools
- **SLO Automation**: Error budget tracking, multi-window burn rate alerts
- **Structured Logging**: JSON loggers with trace correlation for all services

#### Dashboards
- USE Method dashboard
- Capacity Modeling dashboard
- SLO Overview dashboard (updated)

#### Files Added
- `infra/otel/otel-collector-config.yaml`
- `infra/prometheus/rules/capacity-rules.yml`
- `infra/prometheus/rules/slo-rules.yml`
- `services/load-generator/` (new service)
- `scripts/capacity/usl_fitting.py`
- Structured loggers for Go, Python, TypeScript, Java services

---

## [0.17.0] - 2026-01-14

### Phase 16: BFF Consolidation

#### Added
- **Circuit Breaker**: Resilience module with timeout/retry/circuit breaker
- **Orchestration Module**: Aggregation endpoints migrated from Java to NestJS
- **Frontend Direct Connect**: Frontend connects directly to BFF

#### Removed
- **Orchestrator Service**: Java Spring WebFlux gateway removed

---

## [0.16.0] - 2026-01-13

### Phase 13 Security Integration (Follow-up)

#### Added
- **Full TLS Integration**: All services use TLS
- **Rate Limiting**: Per-IP rate limiting on all routes
- **Audit Logging**: Structured audit events

---

## [0.15.0] - 2026-01-12

### Phase 15: Performance Testing

#### Added
- **k6 Performance Tests**: Baseline, sustained, ramp, mixed workload scenarios
- **Baseline Report**: All services meet SLA targets

---

## [0.14.0] - 2026-01-12

### Phase 14: CI/CD Pipeline

#### Added
- **GitHub Actions CI**: Lint, build, test workflows
- **Blue-Green Deploy**: Zero-downtime deployment script

---

## [0.13.0] - 2026-01-12

### Phase 13: Security Hardening

#### Added
- **Vault PKI**: Certificate lifecycle management
- **TLS/mTLS**: All internal services require mTLS
- **Input Validation**: OWASP Top 10 compliant

---

## [0.12.0] - 2026-01-11

### Phase 12: Observability & SRE

#### Added
- SLO definitions, Grafana dashboards, Alertmanager rules

---

## [0.11.0] - 2026-01-10

### Phase 11: Graph Service

#### Added
- Neo4j integration, address clustering, tag propagation

---

## [0.10.0] - 2026-01-09

### Phase 10: ML Pipeline

#### Added
- XGBoost predictor, GNN models, feature engineering

---

## [0.9.0] - 2026-01-08

### Phase 9: Alert Service

#### Added
- Alert rule engine, multi-channel notifications

---

## [0.8.0] - 2026-01-07

### Phase 8: BFF Layer

#### Added
- NestJS BFF, WebSocket support

---

## [0.7.0] - 2026-01-06

### Phase 7: Risk ML Service

#### Added
- FastAPI risk scoring service

---

## [0.6.0] - 2026-01-05

### Phase 6: Query Service

#### Added
- Go/Gin query service, Redis caching

---

## [0.5.0] - 2026-01-04

### Phase 5: Orchestrator

#### Added
- Spring WebFlux gateway, JWT auth

---

## [0.4.0] - 2026-01-03

### Phase 4: Infrastructure

#### Added
- Docker Compose stack

---

## [0.3.0] - 2026-01-02

### Phase 3: Data Ingestion

#### Added
- Blockchain scrapers, Kafka pipeline

---

## [0.2.0] - 2026-01-01

### Phase 2: Data Lake

#### Added
- Apache Hudi, Spark/Flink processing

---

## [0.1.0] - 2025-12-31

### Phase 1: Project Setup

#### Added
- Monorepo structure, dev environment
