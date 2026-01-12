# SLO/SLI Definitions

> Chain Risk Platform Service Level Objectives

---

## Overview

| Metric | Formula | Review Cadence |
|--------|---------|----------------|
| SLI | Measured performance | Real-time |
| SLO | Target threshold | Weekly |
| Error Budget | `(1 - SLO) × time_window` | Monthly |

---

## Service SLOs

### query-service (Go) - Port 8081

| SLI | Target | Error Budget (30d) | Priority |
|-----|--------|-------------------|----------|
| Availability | 99.5% | 3.6h | P1 |
| P99 Latency | <500ms | N/A | P2 |
| Error Rate | <1% | 1% of requests | P2 |

**PromQL Queries:**

```promql
# Availability
sum(rate(http_requests_total{service="query-service",status!~"5.."}[5m])) 
/ sum(rate(http_requests_total{service="query-service"}[5m]))

# P99 Latency
histogram_quantile(0.99, 
  sum(rate(http_request_duration_seconds_bucket{service="query-service"}[5m])) by (le)
)

# Error Rate
sum(rate(http_requests_total{service="query-service",status=~"5.."}[5m])) 
/ sum(rate(http_requests_total{service="query-service"}[5m]))
```

---

### risk-ml-service (Python) - Port 8082

| SLI | Target | Error Budget (30d) | Priority |
|-----|--------|-------------------|----------|
| Availability | 99% | 7.2h | P1 |
| P95 Inference | <200ms | N/A | P1 |
| Model Load Success | 100% | 0 failures | P0 |

**PromQL Queries:**

```promql
# Availability
sum(rate(http_requests_total{service="risk-ml-service",status!~"5.."}[5m])) 
/ sum(rate(http_requests_total{service="risk-ml-service"}[5m]))

# P95 Inference Latency
histogram_quantile(0.95, 
  sum(rate(ml_inference_duration_seconds_bucket{service="risk-ml-service"}[5m])) by (le)
)

# Model Health
ml_model_loaded{service="risk-ml-service"} == 1
```

---

### alert-service (Go) - Port 8083

| SLI | Target | Error Budget (30d) | Priority |
|-----|--------|-------------------|----------|
| Availability | 99.9% | 43min | P0 |
| Notification Success | >99% | 1% failures | P1 |
| Alert Processing Time | <5s | N/A | P2 |

**PromQL Queries:**

```promql
# Availability
sum(rate(http_requests_total{service="alert-service",status!~"5.."}[5m])) 
/ sum(rate(http_requests_total{service="alert-service"}[5m]))

# Notification Success Rate
sum(rate(alert_notifications_sent_total{status="success"}[5m])) 
/ sum(rate(alert_notifications_sent_total[5m]))

# Processing Time P99
histogram_quantile(0.99, 
  sum(rate(alert_processing_duration_seconds_bucket[5m])) by (le)
)
```

---

### graph-service (Java) - Port 8084

| SLI | Target | Error Budget (30d) | Priority |
|-----|--------|-------------------|----------|
| Availability | 99% | 7.2h | P1 |
| P95 Latency | <300ms | N/A | P2 |
| Query Success | >99% | 1% failures | P2 |

**PromQL Queries:**

```promql
# Availability
sum(rate(http_server_requests_seconds_count{service="graph-service",status!~"5.."}[5m])) 
/ sum(rate(http_server_requests_seconds_count{service="graph-service"}[5m]))

# P95 Latency
histogram_quantile(0.95, 
  sum(rate(http_server_requests_seconds_bucket{service="graph-service"}[5m])) by (le)
)
```

---

## Error Budget Calculations

### Formula

```
Error Budget = (1 - SLO_target) × time_window

# Example: 99.5% availability over 30 days
Budget = (1 - 0.995) × 30 × 24 × 60 = 216 minutes = 3.6 hours
```

### Burn Rate

```promql
# Burn Rate (1 = on track, >1 = burning fast)
(1 - sli_value) / (1 - slo_target)

# Multi-window burn rate alert
(
  (1 - avg_over_time(availability[1h])) / (1 - 0.995) > 14.4  # 1h window
  and
  (1 - avg_over_time(availability[5m])) / (1 - 0.995) > 14.4  # 5m window
)
```

### Budget Status Table

| Service | SLO | 30d Budget | Remaining | Status |
|---------|-----|------------|-----------|--------|
| query-service | 99.5% | 3.6h | - | - |
| risk-ml-service | 99% | 7.2h | - | - |
| alert-service | 99.9% | 43min | - | - |
| graph-service | 99% | 7.2h | - | - |

---

## Alert Rules

### Critical Alerts (Page)

| Alert | Condition | For | Severity |
|-------|-----------|-----|----------|
| ErrorBudgetBurn | burn_rate > 14.4 | 2m | critical |
| AvailabilityBreach | availability < (slo - 0.01) | 5m | critical |
| LatencyBreach | p99 > (target × 2) | 5m | critical |

### Warning Alerts (Ticket)

| Alert | Condition | For | Severity |
|-------|-----------|-----|----------|
| ErrorBudgetBurnSlow | burn_rate > 1 | 1h | warning |
| LatencyDegradation | p95 > target | 15m | warning |
| ErrorRateElevated | error_rate > 0.5% | 10m | warning |

---

## Review Process

### Weekly SLO Review

1. Check error budget consumption
2. Review burn rate trends
3. Identify top latency contributors
4. Plan capacity adjustments

### Monthly SLO Calibration

1. Analyze SLO appropriateness
2. Adjust targets if needed
3. Update alert thresholds
4. Document changes

---

## Dashboard Reference

- **Grafana**: `slo-overview` dashboard
- **Prometheus**: `/api/v1/rules?type=alert`
- **Alertmanager**: `/api/v2/alerts`

---

**Last Updated**: 2026-01-12
