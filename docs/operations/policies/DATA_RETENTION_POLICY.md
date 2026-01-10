# Data Retention Policy

Data lifecycle management for development and production environments.

---

## Overview

The platform uses **rolling deletion** to manage storage:
- Hot data in PostgreSQL (configurable retention)
- Cold data archived to Hudi/MinIO
- Neo4j graph with TTL cleanup

---

## Retention Periods

| Environment | PostgreSQL | Neo4j | Alerts |
|-------------|------------|-------|--------|
| Development | 7 days | 7 days | 30 days |
| Staging | 14 days | 14 days | 60 days |
| Production | 30 days | 30 days | 90 days |

---

## Configuration

### Environment Variables

```bash
# .env.local (development defaults)
TRANSFERS_RETENTION_DAYS=7
TRANSACTIONS_RETENTION_DAYS=7
ALERTS_RETENTION_DAYS=30
NEO4J_RETENTION_DAYS=7
PARTITION_DAYS_AHEAD=3
```

### E2E Test Configuration

Tests use short retention to avoid data accumulation:

```bash
# tests/e2e/framework/setup.go
TRANSFERS_RETENTION_DAYS=1
NEO4J_RETENTION_DAYS=1
```

---

## Cleanup Scripts

| Script | Purpose |
|--------|---------|
| `scripts/db/pg-cleanup.sql` | Drop old partitions, create future partitions |
| `scripts/db/pg-partition-setup.sql` | Initial partition table setup |
| `scripts/db/neo4j-cleanup.cypher` | Neo4j node/relationship TTL |
| `scripts/cleanup-cron.sh` | Unified cron wrapper |

---

## Manual Cleanup

```bash
# Run cleanup with custom retention
TRANSFERS_RETENTION_DAYS=3 make cleanup-rolling

# Or via psql directly
psql $PG_CONN -c "SELECT chain_data.rolling_cleanup_with_log(7, 7, 30, 3);"
```

---

## Archive Flow

```
PostgreSQL (hot, N days)
        │
        ▼ (batch-archive job, daily 02:00)
Hudi/MinIO (cold, unlimited)
        │
        ▼ (queryable via Trino)
Historical queries
```

---

## Monitoring

Check partition stats:
```sql
SELECT * FROM chain_data.get_partition_stats();
```

Check cleanup history:
```sql
SELECT * FROM chain_data.cleanup_log ORDER BY executed_at DESC LIMIT 10;
```
