# Phase 17: AIOps Foundation

> SRE/AIOps platform capabilities for capacity planning and observability.

## Status: ✅ Complete

## Deliverables

| Checkpoint | Description | Status |
|------------|-------------|--------|
| CP0 | OTel Data Lake | ✅ |
| CP1 | USE Method Metrics | ✅ |
| CP2 | Load Generator | ✅ |
| CP3 | Capacity Modeling | ✅ |
| CP4 | SLO Automation | ✅ |
| CP5 | Observability Completion | ✅ |

---

## CP0: OTel Data Lake

Archive OTel data to Hudi for ML training.

**Files**:
- `infra/otel/otel-collector-config.yaml` - Dual export to real-time + Kafka
- `infra/init-scripts/hudi/02-otel-tables.sql` - Hudi table definitions
- `processing/batch-processor/.../OTelArchiveJob.java` - Spark archive job
- `infra/airflow/dags/otel_archive.py` - Daily archive DAG

**Data Flow**:
```
OTel Collector → Kafka (otel-*) → Spark → Hudi
```

---

## CP1: USE Method Metrics

Utilization, Saturation, Errors metrics for all services.

**Metrics Added**:

| Service | Utilization | Saturation | Errors |
|---------|-------------|------------|--------|
| query-service | cpu, memory, goroutines, db_pool | db_wait, rate_limit | errors_by_type |
| alert-service | cpu, memory, goroutines, db_pool | db_wait, notification_queue | errors_by_type |
| risk-ml-service | cpu, memory, threads, gpu | rate_limit, inference_queue | errors_by_type |
| graph-service | cpu, memory, threads, neo4j_pool | neo4j_wait, thread_rejected | errors_by_type |
| bff | cpu, memory, event_loop | rate_limit, request_queue | errors_by_type |

**Dashboard**: `infra/grafana/provisioning/dashboards/use-method.json`

---

## CP2: Load Generator

Go-based load generator with multiple arrival patterns.

**Location**: `services/load-generator/`

**Patterns**:
- Constant - steady state
- Ramp - linear increase (USL fitting)
- Step - stepwise increase
- Spike - burst testing
- Diurnal - 24h sine wave

**Scenarios**: `services/load-generator/scenarios/`

---

## CP3: Capacity Modeling

Little's Law validation and USL curve fitting.

**Files**:
- `infra/prometheus/rules/capacity-rules.yml` - Recording rules
- `scripts/capacity/usl_fitting.py` - USL curve fitting script
- `infra/grafana/provisioning/dashboards/capacity-modeling.json`

**Key Formulas**:
```
Little's Law: L = λ × W
USL: X(N) = λN / (1 + σ(N-1) + κN(N-1))
N_max = sqrt((1-σ)/κ)
```

---

## CP4: SLO Automation

Error budget tracking and multi-window burn rate alerting.

**Files**:
- `infra/prometheus/rules/slo-rules.yml` - SLI/SLO recording rules + alerts
- `infra/grafana/provisioning/dashboards/slo-overview.json`

**Alert Thresholds** (per Google SRE):

| Severity | Burn Rate | Long Window | Short Window |
|----------|-----------|-------------|--------------|
| Critical | 14.4x | 1h | 5m |
| High | 6x | 6h | 30m |
| Medium | 3x | 1d | 2h |

---

## CP5: Observability Completion

Structured logging with trace correlation.

**Files**:
- `services/query-service/pkg/logger/structured.go`
- `services/risk-ml-service/app/core/structured_logger.py`
- `services/bff/src/common/structured-logger.ts`
- `services/graph-service/.../logging/StructuredLogger.java`
- `scripts/verify-trace-propagation.sh`

**Log Format**:
```json
{
  "timestamp": "2026-01-14T10:30:00Z",
  "level": "INFO",
  "service": "query-service",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "message": "Request completed",
  "duration_ms": 45
}
```

---

## Updated State

| Dimension | Before | After |
|-----------|--------|-------|
| Metrics | 7/10 | 9/10 |
| Logs | 6/10 | 8/10 |
| Traces | 5/10 | 8/10 |
| SLI/SLO | 8/10 | 10/10 |
| Alerting | 5/10 | 9/10 |
| ML Data | 0/10 | 7/10 |

---

## Future (Phase 18+)

| Phase | Focus |
|-------|-------|
| 18 | Anomaly Detection (Isolation Forest, LSTM-AE) |
| 19 | Root Cause Analysis |
| 20 | Predictive Scaling |
| 21 | Intelligent Alerting |

---

**Completed**: 2026-01-14
