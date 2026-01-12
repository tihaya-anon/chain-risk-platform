# Runbook: High Latency

## Alert

- `svc-latency-high` - P99 latency > 2s
- `slo-latency-breach` - Latency exceeding SLO target

## Symptoms

- API responses slow (>500ms typical)
- Timeouts in upstream services
- User-facing performance degradation
- Grafana latency panels showing spikes

## Impact

- Poor user experience
- Timeout cascades
- SLO breach
- Potential request queuing

## Diagnosis

```bash
# 1. Check which service is slow
curl -sf http://localhost:9090/api/v1/query?query='histogram_quantile(0.99,sum(rate(http_request_duration_seconds_bucket[5m]))by(le,service))'

# 2. Check slow endpoints
curl -sf http://localhost:9090/api/v1/query?query='histogram_quantile(0.99,sum(rate(http_request_duration_seconds_bucket[5m]))by(le,handler))'

# 3. Check database latency
curl -sf http://localhost:9090/api/v1/query?query='histogram_quantile(0.95,sum(rate(pg_stat_statements_seconds_bucket[5m]))by(le))'

# 4. Check resource utilization
docker stats --no-stream
```

## Resolution Steps

### Step 1: Identify Bottleneck

| Location | Check | Fix |
|----------|-------|-----|
| Application | CPU/Memory high | Scale or optimize |
| Database | Query latency | Optimize queries, add indexes |
| Network | Connection latency | Check network, DNS |
| External API | Third-party slow | Add timeout, circuit breaker |

### Step 2: Database Optimization

```bash
# Find slow queries
docker compose exec postgres psql -U chainrisk -c \
  "SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 5;"

# Check missing indexes
docker compose exec postgres psql -U chainrisk -c \
  "SELECT schemaname, tablename, attname, correlation 
   FROM pg_stats 
   WHERE schemaname = 'public' 
   AND correlation < 0.1;"
```

### Step 3: Application Optimization

```bash
# Check if GC is causing latency (Go services)
curl -sf http://localhost:8081/debug/pprof/heap > heap.prof

# Check goroutine count
curl -sf http://localhost:8081/debug/pprof/goroutine?debug=1 | head -20

# Restart to clear potential memory issues
docker compose restart query-service
```

### Step 4: Quick Mitigations

```bash
# Increase resources
docker compose up -d --scale query-service=2

# Enable query caching (if available)
docker compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Reduce concurrent requests (rate limiting)
```

### Step 5: Verify Recovery

```bash
# Watch P99 latency
watch -n 5 'curl -sf http://localhost:9090/api/v1/query?query="histogram_quantile(0.99,sum(rate(http_request_duration_seconds_bucket[1m]))by(le))"'

# Test response time
time curl -sf http://localhost:8081/api/health
```

## SLO Impact

| Service | Target | Breach Threshold |
|---------|--------|------------------|
| query-service | P99 < 500ms | P99 > 1s |
| risk-ml-service | P95 < 200ms | P95 > 400ms |
| graph-service | P95 < 300ms | P95 > 600ms |

## Escalation

| Time | Action |
|------|--------|
| 5min | Start diagnosis |
| 15min | Escalate if P99 > 5s |
| 30min | Consider traffic shedding |

---

**Alert UID**: svc-latency-high, slo-latency-breach  
**Last Updated**: 2026-01-12
