# Phase 12: SRE & Chaos Engineering

> Reliability engineering, fault injection, and incident response

**Estimate**: 5-7 days (single worker)

---

## Goals

1. **SLO/SLI Framework** - Define and track service level objectives
2. **Chaos Testing** - Fault injection with Toxiproxy
3. **Auto-Recovery** - Circuit breaker and graceful degradation
4. **Runbooks** - Incident response documentation

---

## Pre-Phase Status

| Component | Current | Target |
|-----------|---------|--------|
| SLO | Implicit (alert thresholds) | Explicit SLO with error budget |
| Chaos Testing | None | Toxiproxy + automated scenarios |
| Circuit Breaker | Resilience4j (orchestrator only) | All critical paths |
| Runbooks | Scattered | Centralized, actionable |

---

## Checkpoints

| CP | Task | Depends | Est |
|----|------|---------|-----|
| 1 | SLO/SLI Definitions | - | 0.5d |
| 2 | SLO Dashboard | CP-1 | 0.5d |
| 3 | Toxiproxy Setup | - | 0.5d |
| 4 | Chaos Scenarios | CP-3 | 1.5d |
| 5 | Recovery Verification | CP-4 | 1d |
| 6 | Circuit Breaker Enhancement | CP-5 | 1d |
| 7 | Runbooks | CP-5 | 0.5d |
| 8 | Validation & Docs | CP-6,7 | 0.5d |

**Critical Path**: CP-1 → CP-2, CP-3 → CP-4 → CP-5 → CP-6 → CP-8

---

## DAG

```
[CP-1 SLO Definitions]──────────►[CP-2 SLO Dashboard]
                                         │
[CP-3 Toxiproxy Setup]                   │
        │                                │
        ▼                                │
[CP-4 Chaos Scenarios]                   │
        │                                │
        ▼                                │
[CP-5 Recovery Verification]◄────────────┘
        │
        ├──────────────────────┐
        ▼                      ▼
[CP-6 Circuit Breaker]    [CP-7 Runbooks]
        │                      │
        └──────────┬───────────┘
                   ▼
        [CP-8 Validation & Docs]
```

---

## CP-1: SLO/SLI Definitions

**Objective**: Define measurable service level indicators and objectives.

### SLI Definitions

| Service | SLI | Measurement |
|---------|-----|-------------|
| query-service | Availability | `sum(up{job="query-service"}) / count(up{job="query-service"})` |
| query-service | Latency P99 | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` |
| query-service | Error Rate | `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])` |
| risk-ml-service | Inference Latency P95 | `histogram_quantile(0.95, rate(risk_score_latency_seconds_bucket[5m]))` |
| alert-service | Notification Success | `rate(notifications_sent_total{status="success"}[5m]) / rate(notifications_sent_total[5m])` |
| graph-service | Query Latency P95 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |

### SLO Targets

| Service | SLO | Target | Error Budget (30d) |
|---------|-----|--------|-------------------|
| query-service | Availability | 99.5% | 3.6 hours |
| query-service | Latency P99 | < 500ms | - |
| query-service | Error Rate | < 1% | - |
| risk-ml-service | Availability | 99% | 7.2 hours |
| risk-ml-service | Inference P95 | < 200ms | - |
| alert-service | Availability | 99.9% | 43 minutes |
| alert-service | Notification Success | > 99% | - |
| graph-service | Availability | 99% | 7.2 hours |

### Deliverables

- `docs/sre/SLO_DEFINITIONS.md`

### Done When

- [ ] All services have defined SLIs
- [ ] SLO targets documented with rationale
- [ ] Error budget calculation formula documented

---

## CP-2: SLO Dashboard

**Objective**: Grafana dashboard for SLO tracking and error budget burn.

### Panels

1. **Service Availability** - Current vs target (gauge)
2. **Error Budget Remaining** - 30-day rolling (gauge)
3. **Error Budget Burn Rate** - Alert if burning too fast (graph)
4. **Latency Distribution** - P50/P95/P99 per service (heatmap)
5. **SLO Compliance History** - 7-day trend (graph)

### Error Budget Burn Alert

```yaml
# Fast burn: 14.4x budget consumption rate (2% in 1 hour)
expr: |
  (
    1 - (sum(rate(http_requests_total{status!~"5.."}[1h])) / sum(rate(http_requests_total[1h])))
  ) > (14.4 * 0.005)
```

### Deliverables

- `infra/grafana/provisioning/dashboards/slo-overview.json`
- Error budget burn alert in `rules.yaml`

### Done When

- [ ] Dashboard shows real-time SLO status
- [ ] Error budget burn rate alerting works

---

## CP-3: Toxiproxy Setup

**Objective**: Deploy Toxiproxy for fault injection.

### Docker Compose Addition

```yaml
toxiproxy:
  image: ghcr.io/shopify/toxiproxy:2.7.0
  container_name: toxiproxy
  ports:
    - "8474:8474"   # API
    - "25432:25432" # Proxied PostgreSQL
    - "26379:26379" # Proxied Redis
    - "29092:29092" # Proxied Kafka
  networks:
    - backend
```

### Proxy Configuration

| Proxy | Listen | Upstream | Purpose |
|-------|--------|----------|---------|
| postgres-proxy | :25432 | postgres:5432 | DB fault injection |
| redis-proxy | :26379 | redis:6379 | Cache fault injection |
| kafka-proxy | :29092 | kafka:9092 | Message queue faults |

### Service Reconfiguration

Services connect to Toxiproxy ports instead of direct:

```yaml
query-service:
  environment:
    POSTGRES_HOST: toxiproxy
    POSTGRES_PORT: 25432
    REDIS_HOST: toxiproxy
    REDIS_PORT: 26379
```

### Deliverables

- `infra/compose/chaos.yml`
- `infra/toxiproxy/config.json`
- `scripts/chaos/toxiproxy-init.sh`

### Done When

- [ ] Toxiproxy running with all proxies
- [ ] Services connect through proxies
- [ ] Normal operation unaffected (latency < 1ms added)

---

## CP-4: Chaos Scenarios

**Objective**: Implement fault injection test scenarios.

### Scenario Matrix

| ID | Scenario | Target | Toxic | Expected Behavior |
|----|----------|--------|-------|-------------------|
| C1 | DB Latency | postgres-proxy | latency 500ms | Queries slow but succeed |
| C2 | DB Timeout | postgres-proxy | latency 30s | Circuit breaker opens |
| C3 | DB Down | postgres-proxy | limit_data 0 | Graceful error, cached reads |
| C4 | Redis Down | redis-proxy | limit_data 0 | Cache miss, DB fallback |
| C5 | Kafka Latency | kafka-proxy | latency 2s | Producer backs off |
| C6 | Kafka Down | kafka-proxy | limit_data 0 | Events buffered locally |
| C7 | Network Jitter | all | jitter 100ms | Retries succeed |
| C8 | Bandwidth Limit | all | bandwidth 1KB/s | Timeouts on large payloads |

### Test Script Structure

```bash
#!/bin/bash
# tests/chaos/scenarios/db-latency.sh

SCENARIO="C1: Database Latency"
TOXIC="latency"
PROXY="postgres-proxy"
PARAMS='{"latency": 500, "jitter": 100}'

source "$(dirname $0)/../lib/common.sh"

setup_toxic "$PROXY" "$TOXIC" "$PARAMS"
run_health_checks
run_functional_tests
verify_no_errors
cleanup_toxic "$PROXY" "$TOXIC"
report_results
```

### Deliverables

- `tests/chaos/scenarios/*.sh` (8 scenarios)
- `tests/chaos/lib/common.sh` (shared functions)
- `tests/chaos/run-all.sh` (orchestrator)
- `docs/sre/CHAOS_SCENARIOS.md`

### Done When

- [ ] All 8 scenarios scripted
- [ ] Each scenario has pass/fail criteria
- [ ] Can run individually or as suite

---

## CP-5: Recovery Verification

**Objective**: Verify system recovery after fault injection.

### Recovery Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to Detect (TTD) | < 30s | Alert firing time |
| Time to Recover (TTR) | < 60s | Service healthy after fault removed |
| Data Integrity | 100% | No data loss or corruption |
| Request Success After Recovery | > 99% | First 100 requests post-recovery |

### Verification Script

```bash
#!/bin/bash
# tests/chaos/verify-recovery.sh

inject_fault() {
    toxiproxy-cli toxic add -t latency -a latency=30000 postgres-proxy
    INJECT_TIME=$(date +%s)
}

wait_for_detection() {
    # Poll Prometheus alerts
    while ! check_alert_firing "PostgresHighLatency"; do
        sleep 5
        [ $(($(date +%s) - INJECT_TIME)) -gt 60 ] && fail "TTD exceeded"
    done
    TTD=$(($(date +%s) - INJECT_TIME))
}

remove_fault() {
    toxiproxy-cli toxic remove -n latency_downstream postgres-proxy
    REMOVE_TIME=$(date +%s)
}

wait_for_recovery() {
    while ! check_service_healthy "query-service"; do
        sleep 5
        [ $(($(date +%s) - REMOVE_TIME)) -gt 120 ] && fail "TTR exceeded"
    done
    TTR=$(($(date +%s) - REMOVE_TIME))
}

verify_post_recovery() {
    SUCCESS=0
    for i in $(seq 1 100); do
        curl -sf "http://localhost:8081/health" && ((SUCCESS++))
    done
    [ $SUCCESS -ge 99 ] || fail "Post-recovery success rate: $SUCCESS%"
}

report() {
    echo "TTD: ${TTD}s (target: <30s)"
    echo "TTR: ${TTR}s (target: <60s)"
    echo "Post-recovery: ${SUCCESS}%"
}
```

### Deliverables

- `tests/chaos/verify-recovery.sh`
- Recovery metrics in chaos test reports

### Done When

- [ ] TTD < 30s for all critical faults
- [ ] TTR < 60s after fault removal
- [ ] No data loss verified

---

## CP-6: Circuit Breaker Enhancement

**Objective**: Add circuit breakers to Go services (query-service, alert-service).

### Implementation

```go
// pkg/circuitbreaker/breaker.go
package circuitbreaker

import (
    "github.com/sony/gobreaker"
    "time"
)

type Config struct {
    Name        string
    MaxRequests uint32        // Half-open state
    Interval    time.Duration // Reset interval
    Timeout     time.Duration // Open state duration
    Threshold   uint32        // Failures to open
}

func New(cfg Config) *gobreaker.CircuitBreaker {
    return gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        cfg.Name,
        MaxRequests: cfg.MaxRequests,
        Interval:    cfg.Interval,
        Timeout:     cfg.Timeout,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            return counts.ConsecutiveFailures >= cfg.Threshold
        },
        OnStateChange: func(name string, from, to gobreaker.State) {
            log.Printf("Circuit breaker %s: %s -> %s", name, from, to)
            metrics.CircuitBreakerState.WithLabelValues(name, to.String()).Set(1)
        },
    })
}
```

### Service Integration

```go
// services/query-service/internal/repository/postgres.go
type PostgresRepo struct {
    db *sql.DB
    cb *gobreaker.CircuitBreaker
}

func (r *PostgresRepo) GetAddress(ctx context.Context, addr string) (*Address, error) {
    result, err := r.cb.Execute(func() (interface{}, error) {
        return r.queryAddress(ctx, addr)
    })
    if err != nil {
        if err == gobreaker.ErrOpenState {
            return r.getCachedAddress(addr) // Fallback
        }
        return nil, err
    }
    return result.(*Address), nil
}
```

### Configuration

```yaml
# Circuit breaker defaults
circuit_breaker:
  postgres:
    threshold: 5
    timeout: 30s
    max_requests: 3
  redis:
    threshold: 3
    timeout: 10s
    max_requests: 5
  external_api:
    threshold: 3
    timeout: 60s
    max_requests: 2
```

### Metrics

```go
// Prometheus metrics for circuit breaker
var (
    CircuitBreakerState = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "circuit_breaker_state",
            Help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
        },
        []string{"name", "state"},
    )
    CircuitBreakerFailures = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "circuit_breaker_failures_total",
            Help: "Total circuit breaker failures",
        },
        []string{"name"},
    )
)
```

### Deliverables

- `services/query-service/pkg/circuitbreaker/`
- `services/alert-service/pkg/circuitbreaker/`
- Circuit breaker metrics in Prometheus
- Grafana panel for circuit breaker states

### Done When

- [ ] Circuit breakers on DB/Redis/Kafka connections
- [ ] Metrics exported to Prometheus
- [ ] Chaos test C2 triggers circuit breaker

---

## CP-7: Runbooks

**Objective**: Create actionable incident response documentation.

### Runbook Template

```markdown
# Runbook: [Incident Type]

## Overview
Brief description of the incident type.

## Detection
- Alert: `alert_name`
- Dashboard: [link]
- Symptoms: ...

## Severity Assessment
| Condition | Severity |
|-----------|----------|
| ... | P1 |
| ... | P2 |

## Response Steps
1. Step one
2. Step two
3. ...

## Verification
- [ ] Check 1
- [ ] Check 2

## Escalation
- P1: @oncall-primary → @oncall-secondary (15min)
- P2: @oncall-primary (30min)

## Post-Incident
- [ ] Update status page
- [ ] Create incident ticket
- [ ] Schedule postmortem (P1 only)
```

### Runbooks to Create

| Runbook | Trigger Alert |
|---------|---------------|
| Service Down | `infra-service-down` |
| Database Connection Failure | `PostgresConnectionHigh` |
| High Error Rate | `svc-error-rate-high` |
| High Latency | `svc-latency-high` |
| Kafka Consumer Lag | `infra-kafka-lag-high` |
| ML Model Failure | `ml-model-not-loaded` |

### Deliverables

- `docs/sre/runbooks/SERVICE_DOWN.md`
- `docs/sre/runbooks/DATABASE_FAILURE.md`
- `docs/sre/runbooks/HIGH_ERROR_RATE.md`
- `docs/sre/runbooks/HIGH_LATENCY.md`
- `docs/sre/runbooks/KAFKA_LAG.md`
- `docs/sre/runbooks/ML_MODEL_FAILURE.md`
- `docs/sre/runbooks/README.md` (index)

### Done When

- [ ] 6 runbooks created
- [ ] Each linked from Grafana alert annotations
- [ ] Reviewed for actionability

---

## CP-8: Validation & Documentation

**Objective**: End-to-end validation and phase documentation.

### Validation Checklist

```bash
#!/bin/bash
# scripts/validate-phase12.sh

echo "=== Phase 12 Validation ==="

# SLO
echo "[SLO] Checking dashboard..."
curl -sf "http://localhost:13001/api/dashboards/uid/slo-overview" && echo "✓ SLO dashboard exists"

# Toxiproxy
echo "[Chaos] Checking Toxiproxy..."
curl -sf "http://localhost:8474/proxies" | jq -e 'keys | length >= 3' && echo "✓ Toxiproxy configured"

# Chaos scenarios
echo "[Chaos] Running smoke scenario..."
./tests/chaos/scenarios/db-latency.sh --smoke && echo "✓ Chaos scenario works"

# Circuit breaker
echo "[CB] Checking metrics..."
curl -sf "http://localhost:8081/metrics" | grep -q "circuit_breaker" && echo "✓ CB metrics exposed"

# Runbooks
echo "[Runbooks] Checking files..."
[ -f "docs/sre/runbooks/SERVICE_DOWN.md" ] && echo "✓ Runbooks exist"

echo "=== Validation Complete ==="
```

### Documentation Updates

- [ ] Update `AI_CONTEXT.md` with Phase 12 completion
- [ ] Update `CHANGELOG.md`
- [ ] Create `docs/archive/phase-docs/PHASE12_SUMMARY.md`
- [ ] Update `docs/ROADMAP.md` status

### Done When

- [ ] Validation script passes
- [ ] All documentation updated
- [ ] Phase summary written

---

## Success Criteria

- [ ] SLO/SLI defined for all services
- [ ] Error budget dashboard operational
- [ ] 8 chaos scenarios implemented and passing
- [ ] Recovery time < 60s for all scenarios
- [ ] Circuit breakers in Go services
- [ ] 6 runbooks with alert linkage
- [ ] All changes merged to main

---

## File Structure (Final)

```
docs/
└── sre/
    ├── SLO_DEFINITIONS.md
    ├── CHAOS_SCENARIOS.md
    └── runbooks/
        ├── README.md
        ├── SERVICE_DOWN.md
        ├── DATABASE_FAILURE.md
        ├── HIGH_ERROR_RATE.md
        ├── HIGH_LATENCY.md
        ├── KAFKA_LAG.md
        └── ML_MODEL_FAILURE.md

infra/
├── compose/
│   └── chaos.yml
├── toxiproxy/
│   └── config.json
└── grafana/provisioning/dashboards/
    └── slo-overview.json

tests/
└── chaos/
    ├── run-all.sh
    ├── verify-recovery.sh
    ├── lib/
    │   └── common.sh
    └── scenarios/
        ├── db-latency.sh
        ├── db-timeout.sh
        ├── db-down.sh
        ├── redis-down.sh
        ├── kafka-latency.sh
        ├── kafka-down.sh
        ├── network-jitter.sh
        └── bandwidth-limit.sh

services/
├── query-service/pkg/circuitbreaker/
└── alert-service/pkg/circuitbreaker/

scripts/
├── chaos/
│   └── toxiproxy-init.sh
└── validate-phase12.sh
```

---

## Notes

- Toxiproxy only enabled via `chaos.yml` overlay, not in normal operation
- Circuit breaker configuration externalized for tuning
- Runbooks reference Grafana alerts by UID for deep linking

---

**Last Updated**: 2026-01-12
