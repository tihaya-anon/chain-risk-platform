# Changelog

All notable changes to Chain Risk Platform.

---

## [0.16.0] - 2026-01-13

### Phase 13 Security Integration (Follow-up)

#### Added
- **Full TLS Integration**: All services now use TLS server implementation
- **Rate Limiting Wiring**: Per-IP rate limiting middleware active on all routes
- **Audit Logging Wiring**: All API requests logged with structured audit events

#### Modified
- `services/query-service/cmd/query/main.go`: Integrated TLS, rate limiting, audit middleware
- `services/alert-service/cmd/main.go`: Integrated TLS, rate limiting, audit middleware
- `services/risk-ml-service/app/main.py`: Integrated TLS, rate limiting, audit middleware
- `services/bff/src/main.ts`: Integrated TLS server options, audit interceptor
- `services/bff/src/app.module.ts`: Added RateLimitGuard and AuditInterceptor

#### Security Status
| Service | TLS | Rate Limit | Audit |
|---------|-----|------------|-------|
| query-service | ✅ | ✅ | ✅ |
| alert-service | ✅ | ✅ | ✅ |
| risk-ml-service | ✅ | ✅ | ✅ |
| bff | ✅ | ✅ | ✅ |
| orchestrator | ✅ | ✅ | ✅ |
| graph-service | ✅ | ✅ | ✅ |

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

---

## [0.13.0] - 2026-01-12

### Phase 13: Security Hardening

#### Added
- **Vault PKI Infrastructure**: Certificate lifecycle management with Root/Intermediate CA
- **TLS/mTLS**: All services support TLS, internal services require mTLS
- **Rate Limiting**: Configurable rate limits on all public APIs
- **Input Validation**: OWASP Top 10 compliant validation across services
- **Audit Logging**: Structured security event logging to Loki
- **Security Scanning CI**: CodeQL, Semgrep, Trivy, Gitleaks integration

---

## [0.12.0] - 2026-01-11

### Phase 12: Observability & SRE

#### Added
- SLO definitions for all services
- Grafana dashboards for monitoring
- Alertmanager rules
- Runbook documentation

---

## [0.11.0] - 2026-01-10

### Phase 11: Graph Service

#### Added
- Neo4j integration for graph analysis
- Address clustering algorithms
- Tag propagation service
- Path finding capabilities

---

## [0.10.0] - 2026-01-09

### Phase 10: ML Pipeline

#### Added
- XGBoost predictor for risk scoring
- GNN models for graph-based risk assessment
- Feature engineering pipeline
- Model ensemble for improved accuracy

---

## [0.9.0] - 2026-01-08

### Phase 9: Alert Service

#### Added
- Alert rule engine
- Multi-channel notifications (webhook, email, Slack)
- Alert deduplication
- Subscription management

---

## [0.8.0] - 2026-01-07

### Phase 8: BFF Layer

#### Added
- NestJS BFF service
- WebSocket support for real-time alerts
- API aggregation layer
- Gateway authentication

---

## [0.7.0] - 2026-01-06

### Phase 7: Risk ML Service

#### Added
- FastAPI risk scoring service
- Rule-based risk engine
- ML model integration
- Batch scoring API

---

## [0.6.0] - 2026-01-05

### Phase 6: Query Service

#### Added
- Go/Gin query service
- Address lookup API
- Transfer history API
- Redis caching layer

---

## [0.5.0] - 2026-01-04

### Phase 5: Orchestrator

#### Added
- Spring WebFlux gateway
- JWT authentication
- Request routing
- Rate limiting

---

## [0.4.0] - 2026-01-03

### Phase 4: Infrastructure

#### Added
- Docker Compose stack
- PostgreSQL, Redis, Kafka, Neo4j
- Nacos service discovery
- Monitoring stack

---

## [0.3.0] - 2026-01-02

### Phase 3: Data Ingestion

#### Added
- Blockchain data scrapers
- Kafka message pipeline
- Data normalization

---

## [0.2.0] - 2026-01-01

### Phase 2: Data Lake

#### Added
- Apache Hudi integration
- Spark processing jobs
- Flink streaming

---

## [0.1.0] - 2025-12-31

### Phase 1: Project Setup

#### Added
- Monorepo structure
- Development environment
- Documentation framework
