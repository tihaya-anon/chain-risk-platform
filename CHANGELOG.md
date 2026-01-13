# Changelog

All notable changes to Chain Risk Platform.

---

## [0.17.0] - 2026-01-14

### Phase 16: BFF Consolidation

#### Added
- **Circuit Breaker**: Resilience module with timeout/retry/circuit breaker (cockatiel)
- **Orchestration Module**: Aggregation endpoints migrated from Java to NestJS
- **Frontend Direct Connect**: Frontend now connects directly to BFF

#### Removed
- **Orchestrator Service**: Java Spring WebFlux gateway removed
- Simplified architecture from 3-hop to 2-hop

#### Architecture Change
```
Before: Frontend → Orchestrator → BFF → Services (3 hops)
After:  Frontend → BFF → Services (2 hops)
```

#### Migration
- `/api/v1/orchestration/*` endpoints now served by BFF
- Rate limiting, JWT auth, audit logging consolidated in BFF

---

## [0.16.0] - 2026-01-13

### Phase 13 Security Integration (Follow-up)

#### Added
- **Full TLS Integration**: All services now use TLS server implementation
- **Rate Limiting Wiring**: Per-IP rate limiting middleware active on all routes
- **Audit Logging Wiring**: All API requests logged with structured audit events

#### Security Status
| Service | TLS | Rate Limit | Audit |
|---------|-----|------------|-------|
| query-service | ✅ | ✅ | ✅ |
| alert-service | ✅ | ✅ | ✅ |
| risk-ml-service | ✅ | ✅ | ✅ |
| bff | ✅ | ✅ | ✅ |
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

---

## [0.14.0] - 2026-01-12

### Phase 14: CI/CD Pipeline

#### Added
- **GitHub Actions CI**: Lint, build, test workflows for monorepo
- **Build Pipeline**: Docker image build with caching and SBOM
- **Test Automation**: Unit, integration, contract test workflows
- **Blue-Green Deploy**: Zero-downtime deployment script

---

## [0.13.0] - 2026-01-12

### Phase 13: Security Hardening

#### Added
- **Vault PKI Infrastructure**: Certificate lifecycle management
- **TLS/mTLS**: All services support TLS, internal services require mTLS
- **Rate Limiting**: Configurable rate limits on all public APIs
- **Input Validation**: OWASP Top 10 compliant validation
- **Audit Logging**: Structured security event logging to Loki

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

---

## [0.10.0] - 2026-01-09

### Phase 10: ML Pipeline

#### Added
- XGBoost predictor for risk scoring
- GNN models for graph-based risk
- Feature engineering pipeline

---

## [0.9.0] - 2026-01-08

### Phase 9: Alert Service

#### Added
- Alert rule engine
- Multi-channel notifications
- Subscription management

---

## [0.8.0] - 2026-01-07

### Phase 8: BFF Layer

#### Added
- NestJS BFF service
- WebSocket support
- API aggregation layer

---

## [0.7.0] - 2026-01-06

### Phase 7: Risk ML Service

#### Added
- FastAPI risk scoring service
- Rule-based risk engine

---

## [0.6.0] - 2026-01-05

### Phase 6: Query Service

#### Added
- Go/Gin query service
- Redis caching layer

---

## [0.5.0] - 2026-01-04

### Phase 5: Orchestrator

#### Added
- Spring WebFlux gateway
- JWT authentication

---

## [0.4.0] - 2026-01-03

### Phase 4: Infrastructure

#### Added
- Docker Compose stack
- PostgreSQL, Redis, Kafka, Neo4j

---

## [0.3.0] - 2026-01-02

### Phase 3: Data Ingestion

#### Added
- Blockchain data scrapers
- Kafka message pipeline

---

## [0.2.0] - 2026-01-01

### Phase 2: Data Lake

#### Added
- Apache Hudi integration
- Spark/Flink processing

---

## [0.1.0] - 2025-12-31

### Phase 1: Project Setup

#### Added
- Monorepo structure
- Development environment
