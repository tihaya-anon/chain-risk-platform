# Worker A: SRE & Chaos Engineering

> Phase 12 implementation

---

## Role

Implement SRE practices: SLO tracking, chaos testing, fault recovery, incident runbooks.

## Timeline

| Day | Checkpoints | Output |
|-----|-------------|--------|
| 1 | A1: SLO Definitions | `docs/sre/SLO_DEFINITIONS.md` |
| 2 | A2: Dashboard, A3: Toxiproxy | Dashboard JSON, `infra/compose/chaos.yml` |
| 3-4 | A4: Chaos Scenarios | `tests/chaos/scenarios/*.sh` |
| 4 | A5: Recovery Verification | `tests/chaos/verify-recovery.sh` |
| 5 | A6: Circuit Breaker | `services/*/pkg/circuitbreaker/` |
| 5-6 | A7: Runbooks | `docs/sre/runbooks/*.md` |
| 6 | A8: Validation | `scripts/validate-phase12.sh` |

---

## A1: SLO/SLI Definitions

### Task

Define SLIs and SLOs for all services.

### SLO Table

| Service | SLI | Target | Error Budget (30d) |
|---------|-----|--------|-------------------|
| query-service | Availability | 99.5% | 3.6h |
| query-service | P99 Latency | <500ms | - |
| query-service | Error Rate | <1% | - |
| risk-ml-service | Availability | 99% | 7.2h |
| risk-ml-service | P95 Inference | <200ms | - |
| alert-service | Availability | 99.9% | 43min |
| alert-service | Notification Success | >99% | - |
| graph-service | Availability | 99% | 7.2h |
| graph-service | P95 Latency | <300ms | - |

### PromQL Examples

```promql
# Availability
sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# P99 Latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Error Budget Burn Rate
(1 - availability) / (1 - slo_target) # >1 means burning too fast
```

### Deliverable

```markdown
# docs/sre/SLO_DEFINITIONS.md
- Service SLI/SLO table
- PromQL queries for each metric
- Error budget calculation formula
- Review cadence (weekly)
```

### Done

- [ ] All services have defined SLIs
- [ ] PromQL queries validated against Prometheus
- [ ] Document reviewed

---

## A2: SLO Dashboard

### Task

Create Grafana dashboard for SLO tracking.

### Panels

1. **Service Availability** (Gauge) - Current vs target
2. **Error Budget Remaining** (Gauge) - 30-day rolling
3. **Error Budget Burn Rate** (Graph) - Alert if >1
4. **Latency Distribution** (Heatmap) - P50/P95/P99
5. **SLO Compliance** (Graph) - 7-day trend

### Alert Rule

```yaml
# Add to infra/grafana/provisioning/alerting/rules.yaml
- uid: slo-error-budget-burn
  title: Error Budget Burning Fast
  condition: C
  data:
    - refId: A
      model:
        expr: |
          (1 - (sum(rate(http_requests_total{status!~"5.."}[1h])) 
          / sum(rate(http_requests_total[1h])))) / 0.005 > 1
  for: 15m
  labels:
    severity: warning
```

### Deliverable

- `infra/grafana/provisioning/dashboards/slo-overview.json`

### Done

- [ ] Dashboard shows all services
- [ ] Error budget burn alert configured

---

## A3: Toxiproxy Setup

### Task

Deploy fault injection proxy for chaos testing.

### Docker Compose

```yaml
# infra/compose/chaos.yml
services:
  toxiproxy:
    image: ghcr.io/shopify/toxiproxy:2.7.0
    container_name: toxiproxy
    ports:
      - "8474:8474"
      - "25432:25432"  # postgres proxy
      - "26379:26379"  # redis proxy
      - "29092:29092"  # kafka proxy
    volumes:
      - ../toxiproxy/config.json:/config/toxiproxy.json
    command: ["-config", "/config/toxiproxy.json"]
    networks:
      - chainrisk-backend
```

### Proxy Config

```json
// infra/toxiproxy/config.json
[
  {"name": "postgres-proxy", "listen": "0.0.0.0:25432", "upstream": "postgres:5432"},
  {"name": "redis-proxy", "listen": "0.0.0.0:26379", "upstream": "redis:6379"},
  {"name": "kafka-proxy", "listen": "0.0.0.0:29092", "upstream": "kafka:9092"}
]
```

### Service Config Update

```yaml
# When running chaos tests, services use proxy ports
query-service:
  environment:
    POSTGRES_HOST: toxiproxy
    POSTGRES_PORT: 25432
```

### Deliverables

- `infra/compose/chaos.yml`
- `infra/toxiproxy/config.json`
- `scripts/chaos/toxiproxy-init.sh`

### Done

- [ ] Toxiproxy starts with `docker compose -f infra/compose/chaos.yml up`
- [ ] Services connect through proxies
- [ ] Normal latency <1ms added

---

## A4: Chaos Scenarios

### Task

Implement 8 fault injection scenarios.

### Scenario Matrix

| ID | Name | Toxic | Params | Expected |
|----|------|-------|--------|----------|
| C1 | db-latency | latency | 500ms | Slow but OK |
| C2 | db-timeout | latency | 30s | Circuit opens |
| C3 | db-down | limit_data | 0 bytes | Graceful error |
| C4 | redis-down | limit_data | 0 bytes | DB fallback |
| C5 | kafka-latency | latency | 2s | Backoff |
| C6 | kafka-down | limit_data | 0 bytes | Local buffer |
| C7 | network-jitter | jitter | ±100ms | Retries OK |
| C8 | bandwidth | bandwidth | 1KB/s | Timeout |

### Script Template

```bash
#!/bin/bash
# tests/chaos/scenarios/db-latency.sh

set -e
source "$(dirname "$0")/../lib/common.sh"

SCENARIO="C1"
DESCRIPTION="Database latency 500ms"
PROXY="postgres-proxy"
TOXIC_TYPE="latency"
TOXIC_PARAMS='{"latency": 500, "jitter": 100}'

log_start "$SCENARIO" "$DESCRIPTION"

# Inject fault
add_toxic "$PROXY" "$TOXIC_TYPE" "$TOXIC_PARAMS"

# Verify behavior
run_health_check "query-service" 200
run_api_test "GET /api/addresses/0x123" 200 --max-time 5

# Cleanup
remove_toxic "$PROXY" "$TOXIC_TYPE"

log_end "$SCENARIO" "PASS"
```

### Common Library

```bash
# tests/chaos/lib/common.sh

TOXIPROXY_API="http://localhost:8474"

add_toxic() {
  local proxy=$1 type=$2 params=$3
  curl -sf -X POST "$TOXIPROXY_API/proxies/$proxy/toxics" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${type}_test\",\"type\":\"$type\",\"attributes\":$params}"
}

remove_toxic() {
  local proxy=$1 type=$2
  curl -sf -X DELETE "$TOXIPROXY_API/proxies/$proxy/toxics/${type}_test"
}

run_health_check() {
  local service=$1 expected=$2
  local status=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:${SERVICE_PORTS[$service]}/health")
  [ "$status" -eq "$expected" ]
}
```

### Deliverables

- `tests/chaos/scenarios/*.sh` (8 files)
- `tests/chaos/lib/common.sh`
- `tests/chaos/run-all.sh`
- `docs/sre/CHAOS_SCENARIOS.md`

### Done

- [ ] All 8 scenarios scripted
- [ ] `./tests/chaos/run-all.sh` passes
- [ ] Each scenario logs pass/fail

---

## A5: Recovery Verification

### Task

Verify system recovery after fault removal.

### Metrics

| Metric | Target |
|--------|--------|
| Time to Detect (TTD) | <30s |
| Time to Recover (TTR) | <60s |
| Post-recovery success | >99% |

### Script

```bash
#!/bin/bash
# tests/chaos/verify-recovery.sh

source "$(dirname "$0")/lib/common.sh"

# Inject severe fault
add_toxic "postgres-proxy" "latency" '{"latency": 30000}'
INJECT_TIME=$(date +%s)

# Wait for detection (alert firing)
wait_for_alert "PostgresHighLatency" 60
TTD=$(($(date +%s) - INJECT_TIME))

# Remove fault
remove_toxic "postgres-proxy" "latency"
REMOVE_TIME=$(date +%s)

# Wait for recovery
wait_for_healthy "query-service" 120
TTR=$(($(date +%s) - REMOVE_TIME))

# Verify post-recovery
SUCCESS=0
for i in $(seq 1 100); do
  curl -sf "http://localhost:8081/health" && ((SUCCESS++)) || true
done

# Report
echo "TTD: ${TTD}s (target: <30s)"
echo "TTR: ${TTR}s (target: <60s)"
echo "Post-recovery: ${SUCCESS}% (target: >99%)"

[ $TTD -lt 30 ] && [ $TTR -lt 60 ] && [ $SUCCESS -ge 99 ]
```

### Deliverable

- `tests/chaos/verify-recovery.sh`

### Done

- [ ] TTD <30s verified
- [ ] TTR <60s verified
- [ ] No data loss confirmed

---

## A6: Circuit Breaker

### Task

Add circuit breakers to Go services.

### Implementation

```go
// services/query-service/pkg/circuitbreaker/breaker.go
package circuitbreaker

import (
    "time"
    "github.com/sony/gobreaker"
)

func NewDBBreaker() *gobreaker.CircuitBreaker {
    return gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        "postgres",
        MaxRequests: 3,
        Interval:    10 * time.Second,
        Timeout:     30 * time.Second,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            return counts.ConsecutiveFailures >= 5
        },
        OnStateChange: func(name string, from, to gobreaker.State) {
            log.Printf("CB %s: %s -> %s", name, from, to)
            cbStateMetric.WithLabelValues(name).Set(float64(to))
        },
    })
}
```

### Integration

```go
// services/query-service/internal/repository/postgres.go
func (r *Repo) GetAddress(ctx context.Context, addr string) (*Address, error) {
    result, err := r.cb.Execute(func() (interface{}, error) {
        return r.db.QueryContext(ctx, "SELECT * FROM addresses WHERE address = $1", addr)
    })
    if err == gobreaker.ErrOpenState {
        return r.cache.Get(addr) // Fallback to cache
    }
    return result.(*Address), err
}
```

### Metrics

```go
var cbStateMetric = prometheus.NewGaugeVec(
    prometheus.GaugeOpts{
        Name: "circuit_breaker_state",
        Help: "0=closed, 1=half-open, 2=open",
    },
    []string{"name"},
)
```

### Deliverables

- `services/query-service/pkg/circuitbreaker/breaker.go`
- `services/alert-service/pkg/circuitbreaker/breaker.go`
- Grafana panel for CB state

### Done

- [ ] CB in query-service and alert-service
- [ ] Metrics visible in Prometheus
- [ ] Chaos C2 triggers CB open state

---

## A7: Runbooks

### Task

Create 6 incident response runbooks.

### Template

```markdown
# Runbook: [Title]

## Alert
`alert_uid` - [Grafana link]

## Symptoms
- ...

## Impact
- ...

## Steps
1. ...
2. ...

## Verification
- [ ] ...

## Escalation
- P1: 15min → secondary
- P2: 30min → team lead
```

### Runbooks

| File | Alert |
|------|-------|
| SERVICE_DOWN.md | infra-service-down |
| DATABASE_FAILURE.md | postgres-high-latency |
| HIGH_ERROR_RATE.md | svc-error-rate-high |
| HIGH_LATENCY.md | svc-latency-high |
| KAFKA_LAG.md | infra-kafka-lag-high |
| ML_MODEL_FAILURE.md | ml-model-not-loaded |

### Deliverables

- `docs/sre/runbooks/README.md`
- `docs/sre/runbooks/*.md` (6 files)
- Update alert annotations with runbook_url

### Done

- [ ] 6 runbooks created
- [ ] Alerts link to runbooks
- [ ] Steps are actionable

---

## A8: Validation

### Task

End-to-end validation and documentation.

### Script

```bash
#!/bin/bash
# scripts/validate-phase12.sh

echo "=== Phase 12 Validation ==="

# SLO Dashboard
curl -sf "http://localhost:13001/api/dashboards/uid/slo-overview" >/dev/null \
  && echo "✓ SLO dashboard" || echo "✗ SLO dashboard"

# Toxiproxy
curl -sf "http://localhost:8474/proxies" | jq -e 'length >= 3' >/dev/null \
  && echo "✓ Toxiproxy proxies" || echo "✗ Toxiproxy"

# Chaos scenarios
./tests/chaos/scenarios/db-latency.sh >/dev/null 2>&1 \
  && echo "✓ Chaos scenario" || echo "✗ Chaos scenario"

# Circuit breaker metrics
curl -sf "http://localhost:8081/metrics" | grep -q "circuit_breaker" \
  && echo "✓ CB metrics" || echo "✗ CB metrics"

# Runbooks
[ -f "docs/sre/runbooks/SERVICE_DOWN.md" ] \
  && echo "✓ Runbooks" || echo "✗ Runbooks"

echo "=== Done ==="
```

### Deliverables

- `scripts/validate-phase12.sh`
- `docs/archive/phase-docs/PHASE12_SUMMARY.md`
- Update `CHANGELOG.md`

### Done

- [ ] Validation script passes
- [ ] Summary document written
- [ ] Branch merged to main

---

## File Checklist

```
docs/sre/
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
├── compose/chaos.yml
├── toxiproxy/config.json
└── grafana/provisioning/dashboards/slo-overview.json

tests/chaos/
├── run-all.sh
├── verify-recovery.sh
├── lib/common.sh
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

scripts/validate-phase12.sh
```
