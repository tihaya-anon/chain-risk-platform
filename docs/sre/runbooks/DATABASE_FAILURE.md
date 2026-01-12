# Runbook: Database Failure

## Alert

- `infra-postgres-high-latency` - P95 query latency > 1s
- `cb-state-open` - Circuit breaker opened for database

## Symptoms

- Slow API responses (>2s)
- 5xx errors from query-service
- Circuit breaker metrics showing OPEN state
- PostgreSQL connection pool exhausted

## Impact

- Address queries fail or timeout
- Transaction data unavailable
- Risk assessments delayed

## Diagnosis

```bash
# 1. Check PostgreSQL status
docker compose exec postgres pg_isready

# 2. Check connection count
docker compose exec postgres psql -U chainrisk -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='chainrisk';"

# 3. Check active queries
docker compose exec postgres psql -U chainrisk -c \
  "SELECT pid, now() - query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%' 
   ORDER BY duration DESC LIMIT 10;"

# 4. Check circuit breaker state
curl -sf http://localhost:8081/metrics | grep circuit_breaker_state
```

## Resolution Steps

### Step 1: Identify Slow Queries

```bash
# Top slow queries
docker compose exec postgres psql -U chainrisk -c \
  "SELECT query, calls, mean_time, total_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;"
```

### Step 2: Kill Long-Running Queries

```bash
# Identify queries > 30s
docker compose exec postgres psql -U chainrisk -c \
  "SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   AND query_start < now() - interval '30 seconds'
   AND query NOT LIKE '%pg_stat_activity%';"
```

### Step 3: Recovery Actions

| Cause | Action |
|-------|--------|
| Connection exhaustion | Restart query-service to release |
| Long queries | Kill queries, add indexes |
| Lock contention | Identify blocker, kill if safe |
| Resource exhaustion | Increase container resources |

```bash
# Reset connection pool
docker compose restart query-service

# If database unresponsive
docker compose restart postgres
sleep 30
docker compose restart query-service alert-service
```

### Step 4: Verify Recovery

```bash
# Connection count normalized
docker compose exec postgres psql -U chainrisk -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Query latency
curl -sf http://localhost:9090/api/v1/query?query='histogram_quantile(0.95,sum(rate(pg_stat_statements_seconds_bucket[5m]))by(le))'

# Circuit breaker closed
curl -sf http://localhost:8081/metrics | grep "circuit_breaker_state.*0"
```

## Prevention

- Enable query timeout: `statement_timeout = '30s'`
- Monitor slow query log
- Index frequently queried columns
- Connection pool sizing

## Escalation

| Time | Action |
|------|--------|
| 5min | Attempt quick recovery |
| 15min | Page DBA if available |
| 30min | Consider read replica failover |

---

**Alert UID**: infra-postgres-high-latency, cb-state-open  
**Last Updated**: 2026-01-12
