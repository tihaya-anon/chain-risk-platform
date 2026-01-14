# Phase 17: AIOps Foundation

> Transition from Web3 blockchain analytics to SRE/AIOps platform capabilities

## Background

Modern SRE practices focus on **utilization-based capacity management** rather than theoretical queueing models. This phase establishes data pipelines and practical capacity planning tools based on industry practices from Google SRE and Netflix.

## Goals

1. **OTel Data Lake** - Archive observability data to Hudi for ML training
2. **Enhanced Observability** - Utilization metrics for capacity planning
3. **Load Simulation** - API-level load generator for workload testing
4. **Capacity Modeling** - Practical capacity estimation using USL and Little's Law
5. **SLO Automation** - Error budget tracking and burn rate alerting

## Current State Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Metrics | 7/10 | Missing utilization, saturation signals |
| Logs | 6/10 | Basic Loki, needs structured logging |
| Traces | 5/10 | Jaeger configured, propagation unverified |
| SLI/SLO | 8/10 | Definitions complete, lacks automation |
| Alerting | 5/10 | Rules defined, not fully deployed |
| ML Data | 0/10 | No historical data for training |

## Checkpoints

### CP0: OTel Data Lake

Archive OTel data to Hudi for ML training (anomaly detection models require 3-6 months historical data).

**Architecture**:
```
OTel Collector
     │
     ├──→ Prometheus (real-time, 15d retention)
     ├──→ Loki (real-time, 30d retention)
     ├──→ Jaeger (real-time, 7d retention)
     │
     └──→ Kafka (otel-metrics / otel-logs / otel-traces)
              │
              ▼
         Spark Batch (daily archive)
              │
              ▼
         Hudi (permanent, partitioned by service/date)
              │
              ▼
         ML Training Pipeline (future)
```

**Hudi Tables**:

```sql
-- otel_metrics (MOR)
CREATE TABLE otel_metrics (
    metric_name STRING,
    labels MAP<STRING, STRING>,
    value DOUBLE,
    timestamp BIGINT,
    service_name STRING,  -- partition
    dt STRING             -- partition (YYYY-MM-DD)
);

-- otel_logs (MOR)
CREATE TABLE otel_logs (
    trace_id STRING,
    span_id STRING,
    severity STRING,
    body STRING,
    attributes MAP<STRING, STRING>,
    timestamp BIGINT,
    service_name STRING,  -- partition
    dt STRING             -- partition
);

-- otel_traces (MOR)
CREATE TABLE otel_traces (
    trace_id STRING,
    span_id STRING,
    parent_span_id STRING,
    operation_name STRING,
    service_name STRING,
    duration_ms BIGINT,
    status_code STRING,
    attributes MAP<STRING, STRING>,
    timestamp BIGINT,
    dt STRING             -- partition
);
```

**Deliverables**:
- [ ] Kafka topics: `otel-metrics`, `otel-logs`, `otel-traces`
- [ ] OTel Collector config: export to Kafka
- [ ] Spark job: `OTelArchiveJob` (daily 01:00)
- [ ] Hudi tables with Hive metastore sync

---

### CP1: Utilization Metrics

Add **USE Method** (Utilization, Saturation, Errors) metrics to all services.

**Metrics per Service**:

| Metric | Type | Description |
|--------|------|-------------|
| `cpu_utilization_ratio` | Gauge | CPU used / CPU reserved |
| `memory_utilization_ratio` | Gauge | Memory used / Memory reserved |
| `active_requests` | Gauge | Currently processing requests |
| `request_concurrency` | Gauge | In-flight requests (for Little's Law) |
| `connection_pool_utilization` | Gauge | DB connections used / pool size |
| `goroutines_count` | Gauge | Active goroutines (Go services) |
| `thread_pool_active` | Gauge | Active threads (Java service) |

**Saturation Signals** (indicates queuing/backpressure):

| Metric | Type | Description |
|--------|------|-------------|
| `db_connection_wait_total` | Counter | Requests waiting for DB connection |
| `thread_pool_rejected_total` | Counter | Rejected due to pool exhaustion |
| `rate_limit_exceeded_total` | Counter | Requests rejected by rate limiter |

**Deliverables**:
- [ ] Go services: custom Prometheus metrics
- [ ] Java service: Micrometer metrics
- [ ] Python service: prometheus_client metrics
- [ ] BFF: NestJS Prometheus module
- [ ] Grafana USE dashboard per service

---

### CP2: API Load Generator

Create `services/load-generator/` (Go).

**Arrival Patterns**:
- Constant (steady state baseline)
- Step (sudden traffic increase)
- Ramp (gradual increase for USL fitting)
- Spike (burst testing)
- Diurnal (24h pattern simulation)

**Workload Scenarios**:

```yaml
scenarios:
  - name: baseline
    duration: 10m
    workloads:
      - service: query-service
        endpoint: GET /api/v1/addresses/{addr}
        rps: 100
        pattern: constant

  - name: ramp-for-usl
    duration: 30m
    workloads:
      - service: query-service
        endpoint: GET /api/v1/addresses/{addr}
        rps_start: 10
        rps_end: 500
        pattern: ramp
        step_duration: 2m

  - name: spike
    duration: 5m
    workloads:
      - service: risk-ml-service
        endpoint: POST /api/v1/risk/score
        rps: 50
        pattern: constant
      - service: risk-ml-service
        endpoint: POST /api/v1/risk/score
        rps: 500
        pattern: spike
        spike_at: 2m
        spike_duration: 30s
```

**Deliverables**:
- [ ] Load generator with YAML config
- [ ] Predefined scenarios: baseline, stress, spike, soak
- [ ] Metrics export to Prometheus
- [ ] Real-time dashboard

---

### CP3: Capacity Modeling

Implement practical capacity estimation tools.

#### Little's Law Validation

```
L = λ × W

Where:
  L = concurrency (active_requests gauge)
  λ = throughput (requests_per_second)
  W = latency (average response time)
```

**Use Case**: Validate metrics consistency. If `L ≠ λ × W`, metrics are broken.

**Implementation**:
```promql
# Prometheus recording rule
- record: littles_law_deviation_ratio
  expr: |
    (
      avg(active_requests) 
      / 
      (rate(http_requests_total[1m]) * avg(http_request_duration_seconds))
    )
```

Alert if deviation > 20% (indicates metric collection issues).

#### USL (Universal Scalability Law)

Model throughput vs concurrency to predict scaling limits:

```
X(N) = λ × N / (1 + σ(N-1) + κN(N-1))

Where:
  X(N) = throughput at concurrency N
  λ    = throughput per unit (single request)
  σ    = contention coefficient (serialization)
  κ    = coherency coefficient (crosstalk)
```

**Use Case**: 
- Predict when adding replicas stops helping
- Identify serialization bottlenecks (high σ)
- Identify coordination overhead (high κ)

**Implementation**:
1. Run ramp load test (CP2)
2. Collect (concurrency, throughput) data points
3. Fit USL curve using least squares
4. Extract σ and κ coefficients
5. Predict max useful concurrency: `N_max = sqrt((1-σ)/κ)`

**Deliverables**:
- [ ] Little's Law validation recording rules + alerts
- [ ] USL fitting script (Python)
- [ ] Capacity planning notebook
- [ ] Per-service scalability report

---

### CP4: SLO Automation

**Error Budget Calculation**:

```
Error Budget = 1 - SLO Target

Example: 99.9% availability SLO
  → Error Budget = 0.1% = 43.2 minutes/month
```

**Burn Rate**:

```
Burn Rate = Error Rate / Error Budget Rate

Example:
  - SLO: 99.9% (error budget: 0.1%)
  - Current error rate: 0.5%
  - Burn Rate = 0.5% / 0.1% = 5x
  - At this rate, budget exhausts in 30d / 5 = 6 days
```

**Multi-Window Alerts** (Google SRE recommendation):

| Alert | Burn Rate | Long Window | Short Window | Action |
|-------|-----------|-------------|--------------|--------|
| Page | 14.4x | 1h | 5m | Immediate |
| Page | 6x | 6h | 30m | Urgent |
| Ticket | 3x | 1d | 2h | Next business day |
| Ticket | 1x | 3d | 6h | Review |

**Deliverables**:
- [ ] Error budget recording rules
- [ ] Burn rate calculation
- [ ] Multi-window alert rules
- [ ] SLO overview Grafana dashboard
- [ ] Weekly error budget report

---

### CP5: Observability Completion

**Trace Propagation**:
- Verify W3C Trace Context across all services
- Add `trace_id` to structured logs

**Structured Logging**:
```json
{
  "timestamp": "2026-01-14T10:30:00Z",
  "level": "INFO",
  "service": "query-service",
  "trace_id": "abc123",
  "span_id": "def456",
  "message": "Address lookup completed",
  "duration_ms": 45,
  "address": "0x..."
}
```

**Deliverables**:
- [ ] Trace propagation verification script
- [ ] Structured JSON logging across all services
- [ ] Log → Trace correlation in Grafana
- [ ] Service dependency map from traces

---

## Future Directions (Post Phase 17)

| Phase | Focus | Techniques |
|-------|-------|------------|
| 18 | Anomaly Detection | Isolation Forest, LSTM-AE on OTel data |
| 19 | Root Cause Analysis | Causal inference, trace-based diagnosis |
| 20 | Predictive Scaling | Prophet/DeepAR on utilization time series |
| 21 | Intelligent Alerting | Alert clustering, LLM + RAG for runbooks |

---

## References

- [Google SRE Book - Handling Overload](https://sre.google/sre-book/handling-overload/)
- [Google SRE - Capacity Management](https://research.google/pubs/sre-best-practices-for-capacity-management/)
- [Netflix Capacity Modeling](https://github.com/Netflix-Skunkworks/service-capacity-modeling)
- [USE Method - Brendan Gregg](https://www.brendangregg.com/usemethod.html)
- [USL - Neil Gunther](http://www.perfdynamics.com/Manifesto/USLscalability.html)

---

**Status**: Planning  
**Created**: 2026-01-14  
**Updated**: 2026-01-14
