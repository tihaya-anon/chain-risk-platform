# Incident Response Runbooks

> Operational runbooks for Chain Risk Platform

---

## Index

| Runbook | Alert | Severity |
|---------|-------|----------|
| [SERVICE_DOWN](./SERVICE_DOWN.md) | infra-service-down | Critical |
| [DATABASE_FAILURE](./DATABASE_FAILURE.md) | infra-postgres-high-latency, cb-state-open | Critical |
| [HIGH_ERROR_RATE](./HIGH_ERROR_RATE.md) | svc-error-rate-high, slo-error-budget-burn | Warning |
| [HIGH_LATENCY](./HIGH_LATENCY.md) | svc-latency-high, slo-latency-breach | Warning |
| [KAFKA_LAG](./KAFKA_LAG.md) | infra-kafka-lag-high | Warning |
| [ML_MODEL_FAILURE](./ML_MODEL_FAILURE.md) | ml-model-not-loaded | Critical |

---

## Escalation Policy

| Level | Time | Contact | Criteria |
|-------|------|---------|----------|
| L1 | 0min | On-call | All alerts |
| L2 | 15min | Secondary | P1 unresolved |
| L3 | 30min | Team Lead | P0/P1 unresolved |
| L4 | 60min | Manager | Customer impact |

---

## Severity Definitions

| Severity | Response | Examples |
|----------|----------|----------|
| P0 | Immediate | Complete outage, data loss |
| P1 | <15min | Service degraded, >50% users |
| P2 | <1h | Single service down, workaround exists |
| P3 | <4h | Minor issue, no user impact |

---

## Quick Commands

```bash
# Service status
docker compose ps

# Service logs
docker compose logs -f --tail=100 query-service

# Restart service
docker compose restart query-service

# Check metrics
curl http://localhost:9090/api/v1/query?query=up
```

---

**Last Updated**: 2026-01-12
