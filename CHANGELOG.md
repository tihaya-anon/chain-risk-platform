# Changelog

All notable changes to Chain Risk Platform.

---

## [0.18.0] - 2026-01-14

### Phase 18: MEV Detection & Kubernetes Migration

#### Part A: MEV Detection

##### Added
- **Mempool Collector**: Go service for real-time mempool monitoring
  - WebSocket subscription to `newPendingTransactions`
  - DEX swap method detection (Uniswap V2/V3 patterns)
  - Kafka producer to `mempool-pending-txs` topic
  - Auto-reconnect with exponential backoff

- **Flink MEV Detection Job**: CEP patterns for MEV attack detection
  - Sandwich attack pattern: front-tx → victim-tx → back-tx
  - Front-run pattern: similar tx with higher gas
  - Abnormal gas detector: anomalous gas price detection
  - Outputs to `mev-alerts` topic

- **Alert Service Integration**: MEV event types and evaluator
  - MevAlertEvent model with severity levels
  - MevEvaluator for rule-based filtering
  - Kafka consumer for `mev-alerts` topic

#### Part B: Kubernetes Migration

##### Added
- **Helm Charts**: Generic chart for all microservices
  - Deployment, Service, HPA, PDB templates
  - NetworkPolicy, Ingress templates
  - Per-service values files

- **ArgoCD GitOps**: Automated deployment pipeline
  - AppProject with RBAC
  - ApplicationSet for all services
  - Automated sync with prune and self-heal

- **Network Security**:
  - Default deny-all NetworkPolicy
  - Service-to-service communication policies
  - Infrastructure egress policies
  - Production Ingress with TLS and rate limiting

#### Files Added
- `data-ingestion/mempool-collector/` (new service)
- `processing/stream-processor/src/main/java/.../mev/` (new package)
- `services/alert-service/internal/model/mev_event.go`
- `services/alert-service/internal/engine/mev_evaluator.go`
- `infra/k8s/charts/chain-risk-service/`
- `infra/k8s/charts/values/`
- `infra/k8s/argocd/`
- `infra/k8s/base/network-policies.yaml`
- `infra/k8s/base/ingress-prod.yaml`

---

## [0.17.0] - 2026-01-14

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

## [0.16.0] - 2026-01-14

### Phase 16: BFF Consolidation

#### Added
- **Circuit Breaker**: Resilience module with timeout/retry/circuit breaker
- **Orchestration Module**: Aggregation endpoints migrated from Java to NestJS
- **Frontend Direct Connect**: Frontend connects directly to BFF

#### Removed
- **Orchestrator Service**: Java Spring WebFlux gateway removed

---

## [0.15.0] - 2026-01-13

### Phase 13 Security Integration (Follow-up)

#### Added
- **Full TLS Integration**: All services use TLS
- **Rate Limiting**: Per-IP rate limiting on all routes
- **Audit Logging**: Structured audit events

---

## [0.14.0] - 2026-01-12

### Phase 15: Performance Testing

#### Added
- **k6 Performance Tests**: Baseline, sustained, ramp, mixed workload scenarios
- **Baseline Report**: All services meet SLA targets

---

## [0.13.0] - 2026-01-12

### Phase 14: CI/CD Pipeline

#### Added
- **GitHub Actions CI**: Lint, build, test workflows
- **Blue-Green Deploy**: Zero-downtime deployment script

---

## [0.12.0] - 2026-01-12

### Phase 13: Security

#### Added
- **Vault Integration**: Secret management
- **mTLS**: Service-to-service encryption
- **JWT Validation**: Token validation in BFF
