# Runbook: High Error Rate

## Alert

- `svc-error-rate-high` - Error rate > 5%
- `slo-error-budget-burn` - Error budget burning fast

## Symptoms

- 5xx responses increasing
- Error rate dashboard showing spike
- User complaints about failures
- Error budget gauge decreasing

## Impact

- SLO breach risk
- User experience degraded
- Potential data processing failures

## Diagnosis

```bash
# 1. Identify which service has errors
curl -sf http://localhost:9090/api/v1/query?query='sum(rate(http_requests_total{status=~"5.."}[5m]))by(service)'

# 2. Check error types
docker compose logs --tail=500 <service-name> | grep -i "error\|500\|503" | head -50

# 3. Check recent deployments
git log --oneline -10

# 4. Check dependency health
curl -sf http://localhost:8081/health
curl -sf http://localhost:8082/health
curl -sf http://localhost:8083/health
```

## Resolution Steps

### Step 1: Identify Error Source

```bash
# Error breakdown by endpoint
curl -sf http://localhost:9090/api/v1/query?query='sum(rate(http_requests_total{status=~"5.."}[5m]))by(handler)'

# Recent error logs
docker compose logs --since 10m <service-name> 2>&1 | grep -E "500|503|error" | tail -100
```

### Step 2: Common Causes and Fixes

| Pattern | Cause | Fix |
|---------|-------|-----|
| All endpoints 500 | Dependency down | Check DB/Redis/Kafka |
| Single endpoint 500 | Code bug | Rollback if recent deploy |
| Intermittent 503 | Resource exhaustion | Scale or restart |
| Spike after deploy | Bad code release | Rollback |

### Step 3: Quick Mitigation

```bash
# Rollback to previous version
git log --oneline -5
docker compose build <service-name>
docker compose up -d <service-name>

# Scale up (if resource issue)
# Edit docker-compose.yml to increase replicas
docker compose up -d --scale query-service=2
```

### Step 4: Verify Recovery

```bash
# Error rate decreasing
watch -n 5 'curl -sf http://localhost:9090/api/v1/query?query="sum(rate(http_requests_total{status=~\"5..\"}[1m]))"'

# Successful requests
curl -sf http://localhost:8081/api/health
```

## Error Budget Impact

```promql
# Check remaining budget
(1 - (sum(increase(http_requests_total{status!~"5.."}[30d])) 
/ sum(increase(http_requests_total[30d])))) / 0.005
```

If error budget < 20%, consider:
- Freeze non-critical deployments
- Increase monitoring
- Schedule reliability work

## Escalation

| Time | Action |
|------|--------|
| 5min | Start diagnosis |
| 15min | Escalate if >10% error rate |
| 30min | Consider full rollback |

---

**Alert UID**: svc-error-rate-high, slo-error-budget-burn  
**Last Updated**: 2026-01-12
