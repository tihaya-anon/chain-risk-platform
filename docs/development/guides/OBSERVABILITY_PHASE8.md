# Phase 8: Observability Stack

> Logs, Traces, Metrics integration

---

## Status

| Component | Current | Target |
|-----------|---------|--------|
| Prometheus | ✅ Running (targets down) | All targets UP |
| Grafana | ✅ Running (no logs) | Unified dashboards |
| Jaeger | ✅ Running (no integration) | Full tracing |
| Loki | ❌ Missing | Log aggregation |

---

## Assignment Table

| CP | Task | Worker | Depends | Notify | Est |
|----|------|--------|---------|--------|-----|
| 1 | Loki Deployment | W1 | - | W1(2,3) | 0.5d |
| 2 | Promtail Config | W1 | CP-1 | W1(6), W2(7) | 0.5d |
| 3 | Grafana Loki Source | W1 | CP-1 | W1(10) | 0.25d |
| 4 | Prometheus Targets Fix | W2 | - | W2(5) | 0.5d |
| 5 | Business Metrics | W2 | CP-4 | W1(10) | 1d |
| 6 | Python OTel SDK | W1 | CP-2 | W1(8) | 1d |
| 7 | Java OTel Agent | W2 | CP-2 | W1(8) | 0.5d |
| 8 | Trace Export Config | W1 | CP-6,7 | W1(9) | 0.25d |
| 9 | Log-Trace Correlation | W1 | CP-2,8 | W1(10) | 0.5d |
| 10 | Unified Dashboards | W1 | CP-3,5,8 | W1(11) | 1d |
| 11 | Alert Rules | W1 | CP-10 | - | 0.5d |

**Legend**: `Notify W1(6)` = ping Worker 1 for CP-6 after completion

---

## Execution Schedule

| Day | W1 | W2 |
|-----|----|----|
| 1 | CP-1 Loki | CP-4 Prometheus Fix |
| 1.5 | CP-2 Promtail, CP-3 Grafana | CP-5 Business Metrics |
| 2.5 | CP-6 Python OTel | CP-7 Java OTel |
| 3 | CP-8 Trace Config | - |
| 3.5 | CP-9 Correlation | - |
| 4.5 | CP-10 Dashboards | - |
| 5 | CP-11 Alerts | - |

**Critical Path**: CP-1 → CP-2 → CP-6 → CP-8 → CP-9 → CP-10 → CP-11

---

## DAG

```
[CP-1 Loki]─────┬──────────────────────────────[CP-4 Prometheus]
                │                                      │
       ┌────────┼────────┐                             ▼
       ▼        ▼        │                      [CP-5 Metrics]
 [CP-2 Promtail][CP-3 Grafana]                         │
       │                 │                             │
   ┌───┴───┐             │                             │
   ▼       ▼             │                             │
[CP-6   [CP-7            │                             │
Python] Java]            │                             │
   │       │             │                             │
   └───┬───┘             │                             │
       ▼                 │                             │
 [CP-8 Trace]            │                             │
       │                 │                             │
       ▼                 │                             │
 [CP-9 Correlation]      │                             │
       │                 │                             │
       └─────────────────┴─────────────────────────────┘
                         │
                         ▼
                  [CP-10 Dashboards]
                         │
                         ▼
                   [CP-11 Alerts]
```

---

## Checkpoint Details

### CP-1: Loki Deployment (W1)

```yaml
# infra/loki/loki-config.yaml
auth_enabled: false
server:
  http_listen_port: 3100
limits_config:
  retention_period: 168h
```

**Done when**: `/ready` returns 200

---

### CP-2: Promtail Config (W1)

```yaml
# infra/promtail/promtail-config.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
```

**Done when**: Logs appear in Loki within 5s

---

### CP-3: Grafana Loki Source (W1)

```yaml
# grafana/provisioning/datasources/datasources.yml
- name: Loki
  type: loki
  url: http://loki:3100
```

---

### CP-4: Prometheus Targets Fix (W2)

- Fix network (host.docker.internal)
- Add Flink, Neo4j exporters

**Done when**: All targets UP

---

### CP-5: Business Metrics (W2)

| Service | Metric | Type |
|---------|--------|------|
| query-service | `query_transfers_duration_seconds` | Histogram |
| risk-service | `risk_score_distribution` | Histogram |
| alert-service | `alerts_triggered_total{severity}` | Counter |

---

### CP-6: Python OTel SDK (W1)

Services: query-service, risk-ml-service, alert-service

```python
def init_telemetry(app, service_name: str):
    provider = TracerProvider()
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="jaeger:4317"))
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
```

---

### CP-7: Java OTel Agent (W2)

Services: graph-service, stream-processor, batch-processor

```bash
java -javaagent:/opt/opentelemetry-javaagent.jar \
  -Dotel.service.name=graph-service \
  -Dotel.exporter.otlp.endpoint=http://jaeger:4317 \
  -jar app.jar
```

---

### CP-8: Trace Export Config (W1)

```yaml
# docker-compose jaeger env
COLLECTOR_OTLP_ENABLED: "true"
SPAN_STORAGE_TYPE: badger
```

---

### CP-9: Log-Trace Correlation (W1)

```python
class TraceIdFilter(logging.Filter):
    def filter(self, record):
        ctx = trace.get_current_span().get_span_context()
        record.trace_id = format(ctx.trace_id, '032x') if ctx.is_valid else ''
        return True
```

**Done when**: Click trace_id in Grafana opens Jaeger

---

### CP-10: Unified Dashboards (W1)

| Dashboard | Panels |
|-----------|--------|
| Service Overview | RED metrics per service |
| Log Analysis | Volume, errors, search |
| Trace Analysis | Duration histogram, dependencies |

---

### CP-11: Alert Rules (W1)

| Alert | Condition |
|-------|-----------|
| HighErrorRate | error_rate > 5% for 5m |
| HighLatency | p99 > 2s for 5m |
| ServiceDown | up == 0 for 1m |

---

## Success Criteria

- [ ] All logs in Grafana
- [ ] All traces in Jaeger
- [ ] All Prometheus targets UP
- [ ] Log → Trace drill-down works
- [ ] Alerts firing correctly
