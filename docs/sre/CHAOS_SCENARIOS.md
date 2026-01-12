# Chaos Engineering Scenarios

> Fault injection test suite for Chain Risk Platform

---

## Overview

| ID | Name | Toxic | Target | Expected Behavior |
|----|------|-------|--------|-------------------|
| C1 | db-latency | latency 500ms | postgres | Slow but operational |
| C2 | db-timeout | latency 30s | postgres | Circuit breaker opens |
| C3 | db-down | limit_data 0 | postgres | Graceful error response |
| C4 | redis-down | limit_data 0 | redis | DB fallback |
| C5 | kafka-latency | latency 2s | kafka | Backoff, eventual delivery |
| C6 | kafka-down | limit_data 0 | kafka | Local buffering |
| C7 | network-jitter | latency ±100ms | postgres | Retries succeed |
| C8 | bandwidth-limit | bandwidth 1KB/s | postgres | Timeout handling |

---

## Prerequisites

```bash
# Start chaos infrastructure
docker compose -f infra/compose/chaos.yml up -d

# Initialize proxies
./scripts/chaos/toxiproxy-init.sh

# Verify services are running
make services-up
```

---

## Running Tests

```bash
# All scenarios
./tests/chaos/run-all.sh

# Single scenario
./tests/chaos/run-all.sh db-latency
```

---

## Scenario Details

### C1: Database Latency

**Fault**: 500ms latency with 100ms jitter on PostgreSQL.

**Validation**:
- Services respond within SLO (P99 < 2s)
- No errors in response
- Metrics show increased latency

### C2: Database Timeout

**Fault**: 30s latency causing connection timeouts.

**Validation**:
- Circuit breaker opens after 5 consecutive failures
- Fallback to cache or graceful error
- Recovery within 60s after fault removal

### C3: Database Down

**Fault**: Complete connection block to PostgreSQL.

**Validation**:
- API returns 503/500, not crash
- Health endpoint responds (degraded OK)
- No data corruption

### C4: Redis Down

**Fault**: Complete block to Redis cache.

**Validation**:
- Services fall back to database
- Increased latency (acceptable)
- No cache poisoning after recovery

### C5: Kafka Latency

**Fault**: 2s latency on Kafka broker connection.

**Validation**:
- Message processing slows
- No message loss
- Backoff mechanisms activate

### C6: Kafka Down

**Fault**: Complete block to Kafka.

**Validation**:
- Local message buffering
- Services remain healthy
- Messages delivered after recovery

### C7: Network Jitter

**Fault**: Variable latency (50ms ± 100ms).

**Validation**:
- High success rate (>90%)
- Retries work correctly
- No cascading failures

### C8: Bandwidth Limit

**Fault**: 1KB/s bandwidth restriction.

**Validation**:
- Small requests succeed
- Large requests timeout gracefully
- Service remains stable

---

## Metrics to Monitor

```promql
# Circuit breaker state
circuit_breaker_state{service="query-service"}

# Error rate during chaos
rate(http_requests_total{status=~"5.."}[1m])

# Latency percentiles
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))

# Kafka consumer lag
kafka_consumergroup_lag{consumergroup="alert-service"}
```

---

## Adding New Scenarios

1. Create `tests/chaos/scenarios/<name>.sh`
2. Source `lib/common.sh`
3. Use `add_toxic`/`remove_toxic` functions
4. Add to `run-all.sh` SCENARIOS array
5. Document in this file

---

**Last Updated**: 2026-01-12
