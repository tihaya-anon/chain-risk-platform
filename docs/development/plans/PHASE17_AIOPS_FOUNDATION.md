# Phase 17: AIOps Foundation

> Transition from Web3 blockchain analytics to SRE/AIOps platform capabilities

## Background

Leverage existing Hudi data lake infrastructure and mathematical foundations (queueing theory, ML/DL) to build intelligent operations capabilities.

## Goals

1. **OTel Data Lake** - Archive observability data to Hudi for ML training
2. **Enhanced Observability** - Complete metrics coverage for capacity planning
3. **Load Simulation** - API-level load generator for realistic workload testing
4. **Queueing Theory Models** - Apply M/M/1, M/M/k models for capacity estimation
5. **AIOps Foundation** - Establish data pipeline for future ML-based operations

## Current State Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Metrics | 7/10 | Missing queue depth, concurrency, utilization |
| Logs | 6/10 | Basic Loki, needs structured logging |
| Traces | 5/10 | Jaeger configured, propagation unverified |
| SLI/SLO | 8/10 | Complete definitions, lacks automation |
| Alerting | 5/10 | Rules defined, not fully deployed |
| ML Data | 0/10 | No historical data for training |

## Checkpoints

### CP0: OTel Data Lake

Archive OTel data to Hudi for ML training (LSTM, Transformer anomaly detection requires 3-6 months historical data).

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

### CP1: Metrics Enhancement

Add queueing theory metrics to all services:

| Metric | Type | Description |
|--------|------|-------------|
| `request_queue_depth` | Gauge | Pending requests in queue |
| `active_connections` | Gauge | Current active connections |
| `server_utilization` | Gauge | ρ = λ/μ (arrival rate / service rate) |
| `service_time_seconds` | Histogram | Processing time excluding queue wait |

**Deliverables**:
- [ ] Go services: custom Prometheus metrics
- [ ] Java service: Micrometer metrics
- [ ] Python service: prometheus_client metrics
- [ ] BFF: NestJS Prometheus module

---

### CP2: API Load Generator

Create `services/load-generator/` (Go):

**Arrival Patterns**:
- Poisson (random, realistic)
- Constant (steady state)
- Bursty (spike testing)
- Diurnal (24h pattern simulation)

**Workload Types**:
- Address query (query-service)
- Risk scoring (risk-ml-service)
- Graph query (graph-service)
- Alert CRUD (alert-service)

**Config Format**:
```yaml
scenarios:
  - name: baseline
    duration: 10m
    workloads:
      - type: address_query
        rps: 50
        pattern: poisson
      - type: risk_score
        rps: 20
        pattern: constant
```

**Deliverables**:
- [ ] Load generator service with YAML config
- [ ] Predefined scenarios: baseline, stress, spike, soak
- [ ] Real-time metrics dashboard

---

### CP3: Observability Completion

**Trace Propagation**:
- Verify W3C Trace Context across all services
- Add trace_id to structured logs

**SLO Dashboard**:
- Error budget burn rate
- SLI trends (7d, 30d)
- Automated SLO breach alerts

**Deliverables**:
- [ ] Trace context propagation verification
- [ ] Structured JSON logging with trace_id correlation
- [ ] Grafana SLO overview dashboard

---

### CP4: Queueing Theory Models

Implement capacity estimation based on queueing theory:

**Models**:
- M/M/1: Single server analysis
- M/M/k: Multi-server (replicas) analysis
- Little's Law validation: L = λW

**Real-time Estimation**:
```
Given:
  λ = arrival rate (from metrics)
  μ = service rate (from metrics)
  k = replicas

Calculate:
  ρ = λ/(k*μ)           -- utilization
  Lq = queue length     -- from M/M/k formula
  Wq = queue wait time  -- Lq/λ
  
Alert if:
  ρ > 0.8               -- approaching saturation
  Wq > SLO_target       -- SLO at risk
```

**Deliverables**:
- [ ] Queueing model library (Go or Python)
- [ ] Prometheus recording rules for derived metrics
- [ ] Capacity planning dashboard

---

### CP5: Validation & Documentation

- Load test all scenarios
- Validate model accuracy against observed data
- Document architecture and runbooks

**Deliverables**:
- [ ] Load test report
- [ ] Model accuracy analysis
- [ ] `docs/sre/AIOPS_ARCHITECTURE.md`

---

## Future Directions (Post Phase 17)

| Phase | Focus | Models |
|-------|-------|--------|
| 18 | Anomaly Detection | Isolation Forest, LSTM-AE |
| 19 | Root Cause Analysis | Causal inference, Graph analysis |
| 20 | Predictive Scaling | Prophet, DeepAR |
| 21 | Intelligent Alerting | Clustering, LLM + RAG |

---

## References

- [SLO Definitions](../../sre/SLO_DEFINITIONS.md)
- [Baseline Performance Report](../../performance/BASELINE_REPORT.md)
- [Lambda Architecture](../../architecture/components/LAMBDA_ARCHITECTURE.md)
- [Hudi Batch Layer](../HUDI_BATCH_LAYER.md)

---

**Status**: Planning  
**Created**: 2026-01-14  
**Updated**: 2026-01-14
