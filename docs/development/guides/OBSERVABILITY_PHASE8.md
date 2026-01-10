# Phase 8: Observability Stack

> Comprehensive observability with Logs, Traces, and Metrics integration

**Created**: 2026-01-10

---

## Overview

Phase 8 focuses on production-grade observability: centralized logging, distributed tracing, metrics completion, and unified dashboards.

### Current State

| Component | Status | Issue |
|-----------|--------|-------|
| Prometheus | ✅ Running | Service targets unreachable (network) |
| Grafana | ✅ Running | 4 dashboards, no log source |
| Jaeger | ✅ Running | No service integration |
| Loki | ❌ Missing | No centralized logging |

### Goals
1. Centralized log aggregation (Loki + Promtail)
2. Distributed tracing integration (OpenTelemetry → Jaeger)
3. Complete Prometheus metrics collection
4. Log-Trace correlation
5. Unified observability dashboards

---

## Checkpoint Dependency Graph (DAG)

```
                              ┌─────────────────────┐
                              │   CP-1: Loki        │
                              │   Deployment        │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
          ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
          │   CP-2: Promtail│  │   CP-3: Grafana │  │   CP-4: Metrics │
          │   Config        │  │   Loki Source   │  │   Targets Fix   │
          └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
                   │                    │                    │
                   │                    │                    ▼
                   │                    │           ┌─────────────────┐
                   │                    │           │   CP-5: Business│
                   │                    │           │   Metrics       │
                   │                    │           └────────┬────────┘
                   │                    │                    │
    ┌──────────────┴──────────────┐     │                    │
    │                             │     │                    │
    ▼                             ▼     │                    │
┌─────────────────┐     ┌─────────────────┐                  │
│   CP-6: Python  │     │   CP-7: Java    │                  │
│   OTel SDK      │     │   OTel Agent    │                  │
└────────┬────────┘     └────────┬────────┘                  │
         │                       │                           │
         └───────────┬───────────┘                           │
                     │                                       │
                     ▼                                       │
           ┌─────────────────┐                               │
           │   CP-8: Trace   │                               │
           │   Export Config │                               │
           └────────┬────────┘                               │
                    │                                        │
                    ├────────────────────────────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │   CP-9: Log     │
          │   Trace Correlate│
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   CP-10: Unified│
          │   Dashboards    │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   CP-11: Alert  │
          │   Rules         │
          └─────────────────┘
```

---

## Checkpoints

### CP-1: Loki Deployment

**Dependencies**: None  
**Estimated**: 0.5 day

| Task | Description |
|------|-------------|
| 1.1 | Add Loki service to docker-compose |
| 1.2 | Configure Loki storage (filesystem/S3) |
| 1.3 | Set retention policy (7 days default) |
| 1.4 | Verify Loki health endpoint |

**Files**:
```
infra/
├── loki/
│   └── loki-config.yaml
└── docker-compose.yml  (update)
```

**Configuration**:
```yaml
# loki-config.yaml
auth_enabled: false
server:
  http_listen_port: 3100
storage_config:
  filesystem:
    directory: /loki/chunks
limits_config:
  retention_period: 168h  # 7 days
```

**Acceptance Criteria**:
- Loki running on port 3100
- `/ready` endpoint returns 200
- Log ingestion API accessible

---

### CP-2: Promtail Configuration

**Dependencies**: CP-1  
**Estimated**: 0.5 day

| Task | Description |
|------|-------------|
| 2.1 | Add Promtail service to docker-compose |
| 2.2 | Configure Docker log discovery |
| 2.3 | Add label extraction (service, level) |
| 2.4 | Configure pipeline stages |

**Files**:
```
infra/
├── promtail/
│   └── promtail-config.yaml
└── docker-compose.yml  (update)
```

**Configuration**:
```yaml
# promtail-config.yaml
server:
  http_listen_port: 9080
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: [__meta_docker_container_name]
        target_label: container
      - source_labels: [__meta_docker_container_label_com_docker_compose_service]
        target_label: service
    pipeline_stages:
      - json:
          expressions:
            level: level
            msg: msg
      - labels:
          level:
```

**Acceptance Criteria**:
- Promtail discovers all containers
- Logs appear in Loki within 5s
- Labels correctly extracted

---

### CP-3: Grafana Loki Datasource

**Dependencies**: CP-1  
**Estimated**: 0.25 day

| Task | Description |
|------|-------------|
| 3.1 | Add Loki datasource to Grafana provisioning |
| 3.2 | Verify LogQL queries work |
| 3.3 | Test Explore view |

**Files**:
```
infra/grafana/provisioning/datasources/
└── datasources.yml  (update)
```

**Configuration**:
```yaml
- name: Loki
  type: loki
  uid: loki
  access: proxy
  url: http://loki:3100
```

**Acceptance Criteria**:
- Loki appears in Grafana datasources
- `{service="query-service"}` returns logs
- Log volume graph renders

---

### CP-4: Prometheus Targets Fix

**Dependencies**: None  
**Estimated**: 0.5 day

| Task | Description |
|------|-------------|
| 4.1 | Fix service targets (use host.docker.internal or network) |
| 4.2 | Add missing exporters (Flink, Neo4j) |
| 4.3 | Configure scrape relabeling |
| 4.4 | Verify all targets UP |

**Current Issues**:
- Services not in docker network (query/risk/alert run on host)
- Trino returns 401 (auth required)
- MinIO returns 403 (auth required)

**Files**:
```
infra/prometheus/
└── prometheus.yml  (update)
```

**Acceptance Criteria**:
- All targets show `health: up` in Prometheus
- No scrape errors
- Service metrics visible

---

### CP-5: Business Metrics

**Dependencies**: CP-4  
**Estimated**: 1 day

| Task | Description |
|------|-------------|
| 5.1 | Query Service: add query latency histogram |
| 5.2 | Risk Service: add risk score distribution |
| 5.3 | Alert Service: add alert counters by severity |
| 5.4 | Pipeline: add throughput metrics (msg/s) |
| 5.5 | Create recording rules for SLIs |

**Metrics to Add**:

| Service | Metric | Type |
|---------|--------|------|
| query-service | `query_transfers_duration_seconds` | Histogram |
| risk-service | `risk_score_distribution` | Histogram |
| risk-service | `risk_predictions_total` | Counter |
| alert-service | `alerts_triggered_total{severity}` | Counter |
| alert-service | `alerts_active_gauge` | Gauge |
| flink | `transactions_processed_total` | Counter |

**Files**:
```
services/query-service/app/metrics.py
services/risk-ml-service/app/metrics.py
services/alert-service/app/metrics.py
infra/prometheus/rules/recording_rules.yml
```

**Acceptance Criteria**:
- Business metrics exposed on `/metrics`
- Recording rules compute SLIs
- Metrics visible in Prometheus

---

### CP-6: Python Services OpenTelemetry

**Dependencies**: CP-2  
**Estimated**: 1 day

| Task | Description |
|------|-------------|
| 6.1 | Add opentelemetry-* dependencies |
| 6.2 | Initialize TracerProvider |
| 6.3 | Instrument FastAPI (auto) |
| 6.4 | Instrument database clients (SQLAlchemy, Neo4j) |
| 6.5 | Add trace context to logs |

**Services**: query-service, risk-ml-service, alert-service

**Dependencies to Add**:
```
opentelemetry-api
opentelemetry-sdk
opentelemetry-instrumentation-fastapi
opentelemetry-instrumentation-sqlalchemy
opentelemetry-exporter-otlp
```

**Files**:
```
services/query-service/app/telemetry.py
services/risk-ml-service/app/telemetry.py
services/alert-service/app/telemetry.py
```

**Code Pattern**:
```python
# telemetry.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

def init_telemetry(app, service_name: str):
    provider = TracerProvider()
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="jaeger:4317"))
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
```

**Acceptance Criteria**:
- Traces appear in Jaeger UI
- HTTP requests create spans
- Database calls instrumented

---

### CP-7: Java Services OpenTelemetry Agent

**Dependencies**: CP-2  
**Estimated**: 0.5 day

| Task | Description |
|------|-------------|
| 7.1 | Download OTel Java Agent |
| 7.2 | Configure agent via env vars |
| 7.3 | Update docker-compose/run scripts |
| 7.4 | Verify spans exported |

**Services**: graph-service, stream-processor, batch-processor

**Agent Configuration**:
```bash
java -javaagent:/opt/opentelemetry-javaagent.jar \
  -Dotel.service.name=graph-service \
  -Dotel.exporter.otlp.endpoint=http://jaeger:4317 \
  -Dotel.traces.exporter=otlp \
  -jar app.jar
```

**Files**:
```
infra/otel/
└── download-agent.sh
docker-compose.yml  (update service commands)
```

**Acceptance Criteria**:
- Java services appear in Jaeger
- Spring/JDBC calls instrumented
- Flink jobs traced

---

### CP-8: Trace Export Configuration

**Dependencies**: CP-6, CP-7  
**Estimated**: 0.25 day

| Task | Description |
|------|-------------|
| 8.1 | Configure Jaeger OTLP receiver |
| 8.2 | Set sampling strategy (100% dev, 10% prod) |
| 8.3 | Configure trace retention |

**Files**:
```
infra/jaeger/
└── jaeger-config.yaml  (if needed)
docker-compose.yml  (update jaeger env)
```

**Environment Variables**:
```yaml
jaeger:
  environment:
    - COLLECTOR_OTLP_ENABLED=true
    - SPAN_STORAGE_TYPE=badger
    - BADGER_DIRECTORY_VALUE=/badger/data
    - BADGER_DIRECTORY_KEY=/badger/key
```

**Acceptance Criteria**:
- OTLP endpoint (4317) accepting spans
- Traces retained for configured period
- Service dependency graph visible

---

### CP-9: Log-Trace Correlation

**Dependencies**: CP-2, CP-8  
**Estimated**: 0.5 day

| Task | Description |
|------|-------------|
| 9.1 | Add trace_id/span_id to log format |
| 9.2 | Configure Grafana derived fields |
| 9.3 | Test log→trace navigation |

**Python Log Format**:
```python
import logging
from opentelemetry import trace

class TraceIdFilter(logging.Filter):
    def filter(self, record):
        span = trace.get_current_span()
        ctx = span.get_span_context()
        record.trace_id = format(ctx.trace_id, '032x') if ctx.is_valid else ''
        record.span_id = format(ctx.span_id, '016x') if ctx.is_valid else ''
        return True

# Log format
FORMAT = '{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s","trace_id":"%(trace_id)s","span_id":"%(span_id)s"}'
```

**Grafana Derived Field**:
```yaml
# In Loki datasource config
derivedFields:
  - name: TraceID
    matcherRegex: '"trace_id":"([a-f0-9]+)"'
    url: 'http://localhost:26686/trace/${__value.raw}'
    datasourceUid: jaeger
```

**Acceptance Criteria**:
- Logs contain trace_id
- Click trace_id in Grafana → opens Jaeger
- Jaeger shows logs alongside traces

---

### CP-10: Unified Observability Dashboards

**Dependencies**: CP-3, CP-8, CP-5  
**Estimated**: 1 day

| Task | Description |
|------|-------------|
| 10.1 | Create Service Overview dashboard (RED metrics) |
| 10.2 | Create Log Analysis dashboard |
| 10.3 | Create Trace Analysis dashboard |
| 10.4 | Update existing dashboards with log panels |

**Dashboards**:

| Dashboard | Panels |
|-----------|--------|
| Service Overview | Request rate, Error rate, Duration (p50/p95/p99) per service |
| Log Analysis | Log volume by service, Error logs, Log search |
| Trace Analysis | Trace duration histogram, Service dependency map, Slow traces |
| Pipeline Health | Kafka lag, Processing rate, End-to-end latency |

**Files**:
```
infra/grafana/provisioning/dashboards/
├── service-overview.json
├── log-analysis.json
├── trace-analysis.json
└── pipeline-health.json
```

**Acceptance Criteria**:
- All dashboards auto-provisioned
- Drill-down from metrics → logs → traces
- Time range sync across panels

---

### CP-11: Alert Rules Enhancement

**Dependencies**: CP-10  
**Estimated**: 0.5 day

| Task | Description |
|------|-------------|
| 11.1 | Add log-based alerts (error rate spike) |
| 11.2 | Add trace-based alerts (latency SLO breach) |
| 11.3 | Configure notification channels |
| 11.4 | Test alert firing |

**Alert Rules**:

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | error_rate > 5% for 5m | Critical |
| HighLatency | p99_latency > 2s for 5m | Warning |
| ServiceDown | up == 0 for 1m | Critical |
| LogErrorSpike | log_errors > 100/min | Warning |
| TraceTimeout | trace_duration > 10s | Warning |

**Files**:
```
infra/grafana/provisioning/alerting/
├── rules.yaml  (update)
└── contact-points.yaml
```

**Acceptance Criteria**:
- Alerts fire on threshold breach
- Notifications sent (webhook/email)
- Alert history visible

---

## Summary Table

| CP | Name | Dependencies | Days | Priority |
|----|------|--------------|------|----------|
| 1 | Loki Deployment | - | 0.5 | High |
| 2 | Promtail Config | 1 | 0.5 | High |
| 3 | Grafana Loki Source | 1 | 0.25 | High |
| 4 | Metrics Targets Fix | - | 0.5 | High |
| 5 | Business Metrics | 4 | 1 | Medium |
| 6 | Python OTel SDK | 2 | 1 | High |
| 7 | Java OTel Agent | 2 | 0.5 | High |
| 8 | Trace Export Config | 6, 7 | 0.25 | Medium |
| 9 | Log-Trace Correlation | 2, 8 | 0.5 | Medium |
| 10 | Unified Dashboards | 3, 8, 5 | 1 | Medium |
| 11 | Alert Rules | 10 | 0.5 | Low |

**Total Estimated**: ~6.5 days

---

## Execution Order (Parallel Tracks)

| Day | Track A (Logging) | Track B (Tracing) | Track C (Metrics) |
|-----|-------------------|-------------------|-------------------|
| 1 | CP-1: Loki | - | CP-4: Targets Fix |
| 1.5 | CP-2: Promtail | - | CP-5: Business Metrics |
| 2 | CP-3: Grafana Loki | CP-6: Python OTel | CP-5 (cont.) |
| 3 | - | CP-7: Java OTel | - |
| 3.5 | - | CP-8: Trace Config | - |
| 4 | CP-9: Correlation | CP-9 (cont.) | - |
| 5 | CP-10: Dashboards | CP-10 (cont.) | CP-10 (cont.) |
| 6 | CP-11: Alerts | - | - |

**Critical Path**: CP-1 → CP-2 → CP-6 → CP-8 → CP-9 → CP-10 → CP-11

---

## Technology Stack

| Layer | Component | Version | Purpose |
|-------|-----------|---------|---------|
| Logging | Grafana Loki | 2.9.x | Log aggregation |
| Logging | Promtail | 2.9.x | Log collection |
| Tracing | Jaeger | 1.52+ | Trace storage/UI |
| Tracing | OpenTelemetry SDK | 1.20+ | Instrumentation |
| Metrics | Prometheus | 2.45+ | Metrics storage |
| Visualization | Grafana | 10.x | Unified UI |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| High log volume | Configure retention, sampling |
| OTel overhead | Use sampling (10% prod) |
| Storage growth | Set TTL on all stores |
| Dashboard complexity | Start with RED metrics only |

---

## Success Criteria

Phase 8 complete when:
- [ ] All service logs visible in Grafana
- [ ] Traces visible in Jaeger for all services
- [ ] All Prometheus targets UP
- [ ] Log → Trace drill-down working
- [ ] RED dashboards for all services
- [ ] Alerts firing correctly
