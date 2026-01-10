# Phase 8: Observability Stack

> Logs, Traces, Metrics integration

**Created**: 2026-01-10

---

## Overview

| Component | Status | Issue |
|-----------|--------|-------|
| Prometheus | ✅ Running | Service targets unreachable |
| Grafana | ✅ Running | No log source |
| Jaeger | ✅ Running | No service integration |
| Loki | ❌ Missing | - |

### Goals
1. Centralized logging (Loki + Promtail)
2. Distributed tracing (OpenTelemetry → Jaeger)
3. Complete Prometheus metrics
4. Log-Trace correlation
5. Unified dashboards

---

## DAG

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

## Execution Order (by parallelism)

| Phase | Checkpoints | Parallelism | Days |
|-------|-------------|-------------|------|
| 1 | CP-1, CP-4 | 2 workers | 0.5 |
| 2 | CP-2, CP-3, CP-5 | 3 workers | 1 |
| 3 | CP-6, CP-7 | 2 workers | 1 |
| 4 | CP-8 | 1 worker | 0.25 |
| 5 | CP-9 | 1 worker | 0.5 |
| 6 | CP-10 | 1 worker | 1 |
| 7 | CP-11 | 1 worker | 0.5 |

**Critical Path**: CP-1 → CP-2 → CP-6 → CP-8 → CP-9 → CP-10 → CP-11

**Total**: ~5 days (with parallelization)

---

## Checkpoints

### CP-1: Loki Deployment

**Deps**: None | **Est**: 0.5d

- Add Loki to docker-compose
- Configure storage & retention (7d)
- Verify `/ready` returns 200

```yaml
# infra/loki/loki-config.yaml
auth_enabled: false
server:
  http_listen_port: 3100
storage_config:
  filesystem:
    directory: /loki/chunks
limits_config:
  retention_period: 168h
```

---

### CP-2: Promtail Configuration

**Deps**: CP-1 | **Est**: 0.5d

- Add Promtail to docker-compose
- Configure Docker log discovery
- Label extraction (service, level)

```yaml
# infra/promtail/promtail-config.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: [__meta_docker_container_label_com_docker_compose_service]
        target_label: service
```

---

### CP-3: Grafana Loki Datasource

**Deps**: CP-1 | **Est**: 0.25d

- Add Loki datasource provisioning
- Verify LogQL queries

```yaml
# infra/grafana/provisioning/datasources/datasources.yml
- name: Loki
  type: loki
  url: http://loki:3100
```

---

### CP-4: Prometheus Targets Fix

**Deps**: None | **Est**: 0.5d

- Fix network issues (host.docker.internal)
- Add missing exporters (Flink, Neo4j)
- Verify all targets UP

---

### CP-5: Business Metrics

**Deps**: CP-4 | **Est**: 1d

| Service | Metric | Type |
|---------|--------|------|
| query-service | `query_transfers_duration_seconds` | Histogram |
| risk-service | `risk_score_distribution` | Histogram |
| alert-service | `alerts_triggered_total{severity}` | Counter |
| flink | `transactions_processed_total` | Counter |

---

### CP-6: Python Services OpenTelemetry

**Deps**: CP-2 | **Est**: 1d

Services: query-service, risk-ml-service, alert-service

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

---

### CP-7: Java Services OpenTelemetry Agent

**Deps**: CP-2 | **Est**: 0.5d

Services: graph-service, stream-processor, batch-processor

```bash
java -javaagent:/opt/opentelemetry-javaagent.jar \
  -Dotel.service.name=graph-service \
  -Dotel.exporter.otlp.endpoint=http://jaeger:4317 \
  -jar app.jar
```

---

### CP-8: Trace Export Configuration

**Deps**: CP-6, CP-7 | **Est**: 0.25d

- Configure Jaeger OTLP receiver
- Sampling: 100% dev, 10% prod
- Configure retention

```yaml
# docker-compose jaeger env
COLLECTOR_OTLP_ENABLED: "true"
SPAN_STORAGE_TYPE: badger
```

---

### CP-9: Log-Trace Correlation

**Deps**: CP-2, CP-8 | **Est**: 0.5d

- Add trace_id/span_id to logs
- Configure Grafana derived fields

```python
class TraceIdFilter(logging.Filter):
    def filter(self, record):
        span = trace.get_current_span()
        ctx = span.get_span_context()
        record.trace_id = format(ctx.trace_id, '032x') if ctx.is_valid else ''
        return True
```

---

### CP-10: Unified Dashboards

**Deps**: CP-3, CP-5, CP-8 | **Est**: 1d

| Dashboard | Content |
|-----------|---------|
| Service Overview | RED metrics per service |
| Log Analysis | Volume, errors, search |
| Trace Analysis | Duration histogram, dependencies |
| Pipeline Health | Kafka lag, throughput |

---

### CP-11: Alert Rules

**Deps**: CP-10 | **Est**: 0.5d

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | error_rate > 5% for 5m | Critical |
| HighLatency | p99 > 2s for 5m | Warning |
| ServiceDown | up == 0 for 1m | Critical |

---

## Summary

| CP | Name | Deps | Days |
|----|------|------|------|
| 1 | Loki Deployment | - | 0.5 |
| 2 | Promtail Config | 1 | 0.5 |
| 3 | Grafana Loki Source | 1 | 0.25 |
| 4 | Metrics Targets Fix | - | 0.5 |
| 5 | Business Metrics | 4 | 1 |
| 6 | Python OTel SDK | 2 | 1 |
| 7 | Java OTel Agent | 2 | 0.5 |
| 8 | Trace Export Config | 6,7 | 0.25 |
| 9 | Log-Trace Correlation | 2,8 | 0.5 |
| 10 | Unified Dashboards | 3,5,8 | 1 |
| 11 | Alert Rules | 10 | 0.5 |

---

## Success Criteria

- [ ] All logs visible in Grafana
- [ ] Traces in Jaeger for all services
- [ ] All Prometheus targets UP
- [ ] Log → Trace drill-down working
- [ ] RED dashboards ready
- [ ] Alerts firing correctly
