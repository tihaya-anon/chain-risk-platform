# Runbook: Kafka Consumer Lag

## Alert

`infra-kafka-lag-high` - Consumer lag > 10,000 messages

## Symptoms

- Delayed alert notifications
- Transaction data not appearing
- Consumer lag metrics increasing
- Real-time features showing stale data

## Impact

- Alert delivery delayed
- Risk scores not updated
- Data pipeline backlog
- Potential message loss if lag continues

## Diagnosis

```bash
# 1. Check consumer lag
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --all-groups

# 2. Check Kafka broker health
docker compose exec kafka kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092

# 3. Check topic partition status
docker compose exec kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --describe --topic transactions

# 4. Check consumer service logs
docker compose logs --tail=200 alert-service | grep -i "kafka\|consumer\|lag"
```

## Resolution Steps

### Step 1: Identify Lag Source

```bash
# Lag per partition
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group alert-service-group

# Output interpretation:
# - CURRENT-OFFSET: consumer position
# - LOG-END-OFFSET: latest message
# - LAG: difference
```

### Step 2: Common Causes and Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| Slow consumer | High CPU in service | Scale consumers |
| Rebalancing | Consumer joining/leaving | Stabilize deployment |
| Large messages | Processing time high | Batch optimization |
| Downstream slow | DB/API bottleneck | Fix downstream first |

### Step 3: Quick Recovery

```bash
# Scale consumers (if possible)
docker compose up -d --scale alert-service=3

# Reset to latest (data loss - use carefully)
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group alert-service-group \
  --reset-offsets --to-latest \
  --topic transactions \
  --execute

# Restart consumer service
docker compose restart alert-service
```

### Step 4: Monitor Recovery

```bash
# Watch lag decrease
watch -n 5 'docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group alert-service-group 2>/dev/null | tail -5'

# Check processing rate
curl -sf http://localhost:9090/api/v1/query?query='rate(kafka_consumer_records_consumed_total[1m])'
```

## Prevention

1. **Consumer scaling**: Auto-scale based on lag
2. **Batch processing**: Process messages in batches
3. **Partition tuning**: More partitions for parallelism
4. **Monitoring**: Alert earlier (5k threshold)

## Lag Thresholds

| Lag | Severity | Action |
|-----|----------|--------|
| <1,000 | Normal | None |
| 1,000-10,000 | Warning | Monitor |
| 10,000-100,000 | High | Scale consumers |
| >100,000 | Critical | Consider reset |

## Escalation

| Time | Action |
|------|--------|
| 5min | Check consumer health |
| 15min | Scale if not recovering |
| 30min | Consider message skip |
| 60min | Escalate to Kafka admin |

---

**Alert UID**: infra-kafka-lag-high  
**Last Updated**: 2026-01-12
