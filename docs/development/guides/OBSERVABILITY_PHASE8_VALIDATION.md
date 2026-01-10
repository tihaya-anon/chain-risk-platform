# Phase 8 Observability Stack - Validation Plan

## Overview

Phase 8 development is complete with static checks passed. This document outlines the integration test plan to validate the observability stack in the remote environment.

## Prerequisites

- Remote infrastructure running (WSL Docker Compose)
- All services deployed with new configurations
- Network connectivity from macOS to remote

## Validation Checkpoints

### V-1: Loki Service Health

**Objective**: Verify Loki is running and accepting logs

```bash
# Check Loki ready endpoint
curl http://<REMOTE_HOST>:13100/ready

# Check Loki metrics
curl http://<REMOTE_HOST>:13100/metrics | grep loki_ingester
```

**Expected**: `ready` response, ingester metrics present

---

### V-2: Promtail Log Collection

**Objective**: Verify Promtail is scraping Docker container logs

```bash
# Check Promtail targets
curl http://<REMOTE_HOST>:19080/targets

# Check Promtail metrics
curl http://<REMOTE_HOST>:19080/metrics | grep promtail_targets_active
```

**Expected**: 
- All running containers listed as targets
- `promtail_targets_active_total > 0`

---

### V-3: Loki Log Query

**Objective**: Verify logs are queryable in Loki

```bash
# Query logs via Loki API (last 5 minutes)
curl -G "http://<REMOTE_HOST>:13100/loki/api/v1/query_range" \
  --data-urlencode 'query={job="docker"}' \
  --data-urlencode "start=$(date -u -v-5M +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode "limit=10"
```

**Expected**: JSON response with log entries

---

### V-4: Grafana Loki Datasource

**Objective**: Verify Grafana can query Loki

1. Access Grafana UI: `http://<REMOTE_HOST>:13000`
2. Navigate to Explore → Select "Loki" datasource
3. Run query: `{job="docker"}`

**Expected**: Log stream visible in Explore panel

---

### V-5: Jaeger Trace Collection

**Objective**: Verify traces are being collected

```bash
# Check Jaeger services
curl "http://<REMOTE_HOST>:16686/api/services"
```

**Expected**: Services list includes `risk-ml-service`, `query-service`, etc.

---

### V-6: Python OTel Integration

**Objective**: Verify risk-ml-service exports traces

1. Trigger API call to risk-ml-service
2. Check Jaeger for `risk-ml-service` traces

```bash
# Call risk scoring endpoint (via orchestrator)
curl -X POST "http://<REMOTE_HOST>:18080/api/risk/score" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234..."}'

# Query Jaeger for traces
curl "http://<REMOTE_HOST>:16686/api/traces?service=risk-ml-service&limit=5"
```

**Expected**: Trace with spans for HTTP request, Redis, DB operations

---

### V-7: Log-Trace Correlation

**Objective**: Verify trace_id appears in logs

1. Note a `trace_id` from Jaeger
2. Query Loki with that trace_id

```bash
# Query Loki for specific trace
curl -G "http://<REMOTE_HOST>:13100/loki/api/v1/query" \
  --data-urlencode 'query={job="docker"} |= "<TRACE_ID>"'
```

**Expected**: Log entries containing the trace_id

---

### V-8: Grafana Derived Fields

**Objective**: Verify clicking trace_id in logs opens Jaeger

1. Open Grafana Explore → Loki
2. Query logs containing trace_id
3. Click on trace_id link in log line

**Expected**: Redirects to Jaeger trace view

---

### V-9: Unified Dashboard

**Objective**: Verify unified observability dashboard loads correctly

1. Access Grafana → Dashboards → Unified Observability
2. Check all panels render without errors

**Panels to verify**:
- [ ] Request Rate (Prometheus)
- [ ] Error Rate (Prometheus)
- [ ] P99 Latency (Prometheus)
- [ ] Log Volume by Level (Loki)
- [ ] Error Logs (Loki)
- [ ] Trace Service Map (Jaeger - if panel exists)

---

### V-10: Alert Rules

**Objective**: Verify Grafana alert rules are provisioned

1. Access Grafana → Alerting → Alert Rules
2. Verify rules exist:
   - High Error Rate
   - High Latency (P99)
   - Service Down
   - Loki Down
   - Jaeger Down

**Expected**: All rules in "Normal" or "Pending" state (not "Error")

---

## Test Execution

### Quick Validation Script

```bash
#!/bin/bash
REMOTE_HOST="${REMOTE_HOST:-<your-remote-ip>}"

echo "=== V-1: Loki Health ==="
curl -s "http://$REMOTE_HOST:13100/ready" && echo " OK" || echo " FAIL"

echo "=== V-2: Promtail Targets ==="
curl -s "http://$REMOTE_HOST:19080/targets" | jq '.activeTargets | length' 

echo "=== V-5: Jaeger Services ==="
curl -s "http://$REMOTE_HOST:16686/api/services" | jq '.data'

echo "=== Grafana Access ==="
curl -s -o /dev/null -w "%{http_code}" "http://$REMOTE_HOST:13000/api/health"
```

### Manual Verification Checklist

| Checkpoint | Command/Action | Status |
|------------|----------------|--------|
| V-1 | Loki /ready | ⬜ |
| V-2 | Promtail /targets | ⬜ |
| V-3 | Loki query API | ⬜ |
| V-4 | Grafana Loki Explore | ⬜ |
| V-5 | Jaeger /api/services | ⬜ |
| V-6 | risk-ml-service trace | ⬜ |
| V-7 | Log contains trace_id | ⬜ |
| V-8 | Derived field link | ⬜ |
| V-9 | Dashboard panels | ⬜ |
| V-10 | Alert rules | ⬜ |

---

## Troubleshooting

### Loki not receiving logs

1. Check Promtail logs: `docker logs promtail`
2. Verify Promtail can reach Loki: `docker exec promtail wget -q -O- http://loki:3100/ready`
3. Check Docker socket mount in Promtail container

### Traces not appearing in Jaeger

1. Check service logs for OTel export errors
2. Verify OTLP endpoint configuration: `OTEL_EXPORTER_OTLP_ENDPOINT`
3. Check Jaeger collector logs: `docker logs jaeger`

### Log-Trace correlation not working

1. Verify logs are JSON formatted with `trace_id` field
2. Check Loki JSON parsing in Promtail config
3. Verify Grafana derived field regex pattern

---

## Success Criteria

Phase 8 is validated when:

- [ ] All 10 checkpoints pass
- [ ] End-to-end flow: API call → Trace in Jaeger → Logs in Loki with trace_id
- [ ] Unified dashboard shows metrics, logs, and traces
- [ ] Alert rules provisioned without errors
