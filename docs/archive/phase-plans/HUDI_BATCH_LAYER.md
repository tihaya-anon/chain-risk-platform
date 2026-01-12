# Lambda Architecture - Hudi Data Lake Implementation

> Batch Layer with Apache Hudi for historical data management

**Date**: 2026-01-05  
**Status**: ✅ Complete

---

## Overview

The Lambda Architecture Batch Layer uses Apache Hudi as a data lake for:
1. **Cold Data Storage** - Archive historical data from PostgreSQL
2. **Batch Correction** - Apply risk scoring and data corrections
3. **Query Federation** - Query via Trino SQL engine

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Speed Layer (Flink)                      │
│  Kafka → Flink ──┬─→ PostgreSQL (hot data, 7 days)             │
│                  └─→ Neo4j (graph)                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Batch Layer (Spark + Hudi)               │
│                                                                 │
│  Archive Job (Daily 02:00)                                      │
│  PostgreSQL (cold data) ──→ Hudi/MinIO ──→ Delete from PG      │
│                                                                 │
│  Correction Job (Daily 03:00)                                   │
│  Hudi ──→ Risk Scoring ──→ Hudi (upsert)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Serving Layer                            │
│  PostgreSQL (recent) ←── Query Service ──→ Trino/Hudi (history)│
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### Infrastructure

| Component | Purpose | Port |
|-----------|---------|------|
| MinIO | S3-compatible object storage | 19000, 19001 |
| Hive Metastore | Table metadata management | 19083 |
| Trino | SQL query engine | 18081 |

### Batch Jobs

| Job | File | Purpose |
|-----|------|---------|
| Archive | `ArchiveToHudiJob.java` | PostgreSQL → Hudi archival |
| Correction | `HudiBatchCorrectionJob.java` | Risk scoring on Hudi data |

---

## Data Flow

### Archive Job

```
PostgreSQL                         Hudi (MinIO)
┌──────────────────┐              ┌──────────────────┐
│ chain_data.      │              │ transfers/       │
│ transfers        │   Archive    │ network=eth/     │
│ (timestamp < 7d) │ ──────────→  │   dt=2026-01-01/ │
└──────────────────┘              │   *.parquet      │
        │                         └──────────────────┘
        ▼                                 │
   DELETE archived                        ▼
                                 Hive Metastore Sync
```

### Correction Job

```
Hudi (Read)                        Hudi (Write)
┌──────────────────┐              ┌──────────────────┐
│ transfers        │              │ transfers        │
│ - tx_hash        │  Correction  │ + risk_score     │
│ - from_address   │ ──────────→  │ + risk_category  │
│ - to_address     │              │ + is_exchange    │
│ - value          │              │ + correction_*   │
└──────────────────┘              └──────────────────┘
```

---

## Files

### Batch Processor

```
processing/batch-processor/
├── src/main/java/com/chainrisk/batch/
│   ├── BatchProcessorApp.java           # Unified entry point
│   ├── job/
│   │   ├── ArchiveToHudiJob.java        # Archive job
│   │   └── HudiBatchCorrectionJob.java  # Correction job
│   ├── model/
│   │   └── Transfer.java
│   └── sink/
│       └── Neo4jBatchWriter.java        # Neo4j sync (optional)
└── pom.xml
```

### Scripts

```
scripts/
├── run-archive-job.sh        # Run archive job
├── run-batch-correction.sh   # Run correction job
└── trino-query.sh            # Query Hudi via Trino
```

### Infrastructure

```
infra/
├── trino/catalog/
│   └── hudi.properties       # Trino Hudi connector config
├── hive/
│   ├── Dockerfile            # Hive Metastore image
│   └── entrypoint.sh
└── init-scripts/hudi/
    └── init-hudi.sh          # Initialize Hudi infrastructure
```

---

## Usage

### Build

```bash
make batch-build
# or
cd processing/batch-processor && mvn package -DskipTests -Plocal
```

### Run Archive Job

```bash
make batch-archive
# or
./scripts/run-archive-job.sh

# Archive all data (for testing)
RETENTION_DAYS=0 ./scripts/run-archive-job.sh
```

### Run Correction Job

```bash
make batch-correct
# or
./scripts/run-batch-correction.sh

# Correct specific date range
START_DATE=2026-01-01 END_DATE=2026-01-03 ./scripts/run-batch-correction.sh
```

### Run Full Pipeline

```bash
make batch-run  # Runs archive + correct
```

### Query Data

```bash
# Count records
./scripts/trino-query.sh "SELECT count(*) FROM hudi.chainrisk.transfers"

# Risk distribution
./scripts/trino-query.sh "SELECT risk_category, count(*) FROM hudi.chainrisk.transfers GROUP BY risk_category"

# By date
./scripts/trino-query.sh "SELECT dt, count(*) FROM hudi.chainrisk.transfers GROUP BY dt ORDER BY dt"
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RETENTION_DAYS` | 7 | Days to keep in PostgreSQL |
| `HUDI_BASE_PATH` | s3a://chainrisk-datalake/hudi | Hudi storage path |
| `MINIO_ENDPOINT` | http://localhost:19000 | MinIO endpoint |
| `HIVE_METASTORE_URI` | thrift://localhost:19083 | Hive Metastore |
| `START_DATE` | (none) | Filter start date for correction |
| `END_DATE` | (none) | Filter end date for correction |

---

## Risk Scoring

The correction job applies risk scores based on:

| Risk Score | Category | Criteria |
|------------|----------|----------|
| 80 | HIGH | Value > 1M tokens |
| 50 | MEDIUM | Value > 100K tokens |
| 20 | LOW | Value ≤ 100K tokens |

Additional fields:
- `is_exchange`: Flag for known exchange addresses
- `correction_timestamp`: When correction was applied
- `correction_version`: Version of correction algorithm

---

## Scheduling

### Cron

```bash
# Daily at 2 AM: Archive cold data
0 2 * * * /path/to/scripts/run-archive-job.sh

# Daily at 3 AM: Run batch correction  
0 3 * * * /path/to/scripts/run-batch-correction.sh
```

### Airflow

```python
with DAG('lambda_batch_layer', schedule='0 2 * * *') as dag:
    archive = BashOperator(task_id='archive', bash_command='./scripts/run-archive-job.sh')
    correct = BashOperator(task_id='correct', bash_command='./scripts/run-batch-correction.sh')
    archive >> correct
```

---

## Related Documentation

- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
- [Technical Decisions](../architecture/TECH_DECISIONS.md)
- [Batch Processor README](../../processing/batch-processor/README.md)
