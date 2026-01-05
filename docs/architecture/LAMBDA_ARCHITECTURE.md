# Lambda Architecture - Chain Risk Platform

> Real-time stream processing + Batch correction with Apache Hudi data lake

---

## Overview

Lambda Architecture combines **stream processing** (fast, approximate) with **batch processing** (accurate, complete) to achieve:
- **Real-time**: Sub-second latency for queries
- **Accuracy**: Eventual consistency via batch correction

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       Data Ingestion                             │
│                    Chain Data Ingestion (Go)                     │
│                            ↓                                     │
│                      Kafka Topics                                │
│                    - raw-blocks                                  │
│                    - transfers                                   │
└─────────────────────────┬────────────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────────┐          ┌─────────────────────┐
│   Speed Layer       │          │   Batch Layer       │
│   (Flink Stream)    │          │   (Spark + Hudi)    │
│                     │          │                     │
│   - Fast parsing    │          │   - Archive to Hudi │
│   - Dual-write DB   │          │   - Risk scoring    │
│   - Simple rules    │          │   - Data correction │
└──────┬──────┬───────┘          └──────┬──────────────┘
       │      │                         │
       │      └────────┐                │
       │               │                │
       ▼               ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │   Neo4j     │  │ Hudi/MinIO  │
│ (hot, 7d)   │  │   (graph)   │  │ (cold data) │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │   Serving Layer     │
              │                     │
              │   - Query Service   │
              │   - Trino (Hudi)    │
              │   - Risk Service    │
              └─────────────────────┘
```

---

## Three Layers

### 1. Speed Layer (Flink)

**Purpose**: Sub-second data processing for real-time queries

**Technology**: Flink Stream Processor (Java), Kafka

**Data Flow**:
```
Kafka (raw-blocks)
    ↓
Flink Stream Processor
    ├─ Parse Transfer (Native + ERC20)
    ├─ Simple validation
    └─ Real-time rules (blacklist check)
    ↓
Dual-write
├─ PostgreSQL (source='stream', hot data 7 days)
└─ Neo4j (source='stream', graph relationships)
    ↓
Kafka (transfers topic)
    └─ Trigger downstream consumers
```

**Characteristics**:
- ✅ Real-time (sub-second latency)
- ✅ High throughput
- ⚠️ May have errors (parsing failures, block reorgs)
- ⚠️ Simple rules only (no complex ML models)

---

### 2. Batch Layer (Spark + Hudi)

**Purpose**: 
- Archive cold data from PostgreSQL to Hudi
- Apply batch corrections with risk scoring
- Store complete historical data

**Technology**: 
- Apache Spark 3.5.0 (Java)
- Apache Hudi 0.15.0 (data lake)
- MinIO (S3-compatible storage)
- Hive Metastore (metadata)
- Trino (SQL queries)

**Data Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Archive Job (Daily 02:00)                                      │
│                                                                 │
│  PostgreSQL (timestamp < 7 days ago)                            │
│       ↓                                                         │
│  Spark: Read → Transform → Write Hudi                           │
│       ↓                                                         │
│  Hudi (s3a://chainrisk-datalake/hudi/transfers)                │
│       ↓                                                         │
│  Delete archived data from PostgreSQL                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Correction Job (Daily 03:00)                                   │
│                                                                 │
│  Hudi (read historical data)                                    │
│       ↓                                                         │
│  Spark: Apply risk scoring                                      │
│       - Calculate risk_score (HIGH/MEDIUM/LOW)                  │
│       - Flag exchange addresses                                 │
│       - Add correction metadata                                 │
│       ↓                                                         │
│  Hudi (upsert corrected data)                                  │
│       ↓                                                         │
│  Sync to Hive Metastore (for Trino queries)                    │
└─────────────────────────────────────────────────────────────────┘
```

**Hudi Table Schema**:
```
transfers (COPY_ON_WRITE)
├── tx_hash (recordKey)
├── block_number (precombineKey)
├── log_index
├── from_address
├── to_address
├── value
├── token_address
├── token_symbol
├── timestamp
├── network (partition)
├── dt (partition)
├── source ('archive' | 'batch')
├── risk_score
├── risk_category (HIGH | MEDIUM | LOW)
├── is_exchange
├── correction_timestamp
└── correction_version
```

**Characteristics**:
- ✅ Low storage cost (object storage)
- ✅ Schema evolution support
- ✅ Time travel queries
- ✅ PostgreSQL stays small (7 days only)
- ✅ Complex analytics possible

---

### 3. Serving Layer

**Purpose**: Unified query interface for hot and cold data

**Technology**:
- Query Service (Go) - query routing
- Trino - Hudi SQL queries
- Risk Service (Python) - risk scoring API
- Graph Engine (Java) - graph analysis

**Query Routing**:
```go
func GetTransfers(addr string, startTime, endTime int64) ([]Transfer, error) {
    sevenDaysAgo := time.Now().AddDate(0, 0, -7).Unix()
    
    if startTime >= sevenDaysAgo {
        // Hot data only → PostgreSQL
        return queryPostgres(addr, startTime, endTime)
    } else if endTime < sevenDaysAgo {
        // Cold data only → Trino/Hudi
        return queryTrino(addr, startTime, endTime)
    } else {
        // Mixed → merge both
        hot := queryPostgres(addr, sevenDaysAgo, endTime)
        cold := queryTrino(addr, startTime, sevenDaysAgo)
        return mergeAndDedupe(cold, hot)
    }
}
```

**Data Source Selection**:

| Query Type     | Data Source | Reason                        |
| -------------- | ----------- | ----------------------------- |
| Recent 7 days  | PostgreSQL  | Low latency, high concurrency |
| Historical     | Trino/Hudi  | Large scans, low cost         |
| Cross-boundary | Both        | Merge and dedupe              |
| Graph queries  | Neo4j       | Relationship analysis         |

---

## Scheduling

### Cron

```bash
# Archive: Daily at 02:00
0 2 * * * ./scripts/run-archive-job.sh

# Correction: Daily at 03:00
0 3 * * * ./scripts/run-batch-correction.sh
```

### Airflow

```python
with DAG('lambda_batch_layer', schedule='0 2 * * *') as dag:
    archive = BashOperator(
        task_id='archive',
        bash_command='./scripts/run-archive-job.sh'
    )
    correct = BashOperator(
        task_id='correct', 
        bash_command='./scripts/run-batch-correction.sh'
    )
    archive >> correct
```

---

## Monitoring

### Key Metrics

```yaml
# Speed Layer
flink_stream:
  - kafka_lag: Message backlog
  - processing_rate: Records/second
  - error_rate: Parsing errors

# Batch Layer
spark_batch:
  - job_duration: Execution time
  - records_archived: Archive count
  - records_corrected: Correction count

# Serving Layer
query_service:
  - query_latency_p99: 99th percentile latency
  - cache_hit_rate: Query cache efficiency
```

### Data Quality Report

```sql
-- Daily stream vs batch comparison
SELECT 
    dt,
    COUNT(*) as total_records,
    AVG(risk_score) as avg_risk_score,
    COUNT(*) FILTER (WHERE risk_category = 'HIGH') as high_risk_count
FROM hudi.chainrisk.transfers
WHERE dt >= current_date - interval '7' day
GROUP BY dt
ORDER BY dt DESC;
```

---

## Benefits

| Dimension    | Lambda Architecture Advantage        |
| ------------ | ------------------------------------ |
| Real-time    | Flink provides sub-second latency    |
| Accuracy     | Spark batch corrects errors          |
| Completeness | Eventual consistency guaranteed      |
| Decoupling   | Stream and batch scale independently |
| Cost         | Cold data in cheap object storage    |
| Scalability  | Each layer scales separately         |

---

## Related Documentation

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Technical Decisions](./TECH_DECISIONS.md)
- [Hudi Batch Layer](../development/HUDI_BATCH_LAYER.md)
- [Batch Processor README](../../processing/batch-processor/README.md)

---

**Last Updated**: 2026-01-05
