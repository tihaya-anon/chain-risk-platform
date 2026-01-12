# Runbook: Service Down

## Alert

`infra-service-down` - Service health check failing

## Symptoms

- Prometheus `up` metric = 0
- Health endpoint returns non-200 or timeout
- No logs from service container

## Impact

- API requests fail for affected service
- Dependent services may cascade fail
- User-facing features unavailable

## Diagnosis

```bash
# 1. Check container status
docker compose ps | grep -E "(query|risk|alert|graph)-service"

# 2. Check recent logs
docker compose logs --tail=200 <service-name> | grep -i "error\|fatal\|panic"

# 3. Check resource usage
docker stats --no-stream | grep <service-name>

# 4. Check connectivity to dependencies
docker compose exec <service-name> nc -zv postgres 5432
docker compose exec <service-name> nc -zv redis 6379
```

## Resolution Steps

### Step 1: Identify Root Cause

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Container exited | OOM/crash | Check logs, increase memory |
| Container running, unhealthy | Dependency issue | Check DB/Redis/Kafka |
| No container | Deploy failed | Check docker-compose |
| Resource exhausted | Memory/CPU spike | Scale or restart |

### Step 2: Quick Recovery

```bash
# Restart single service
docker compose restart <service-name>

# If restart fails, recreate
docker compose up -d --force-recreate <service-name>

# If dependency issue, restart dependency first
docker compose restart postgres
sleep 10
docker compose restart query-service
```

### Step 3: Verify Recovery

```bash
# Health check
curl -sf http://localhost:<port>/health && echo "OK"

# Prometheus target
curl -sf http://localhost:9090/api/v1/query?query=up | jq '.data.result'

# Test API endpoint
curl -sf http://localhost:<port>/api/health
```

## Post-Incident

- [ ] Collect logs before cleanup
- [ ] Document timeline in incident report
- [ ] Review for recurring patterns
- [ ] Update monitoring if gap found

## Escalation

| Time | Action |
|------|--------|
| 5min | Page secondary on-call |
| 15min | Escalate to team lead |
| 30min | Consider rollback if recent deploy |

---

**Alert UID**: infra-service-down  
**Last Updated**: 2026-01-12
