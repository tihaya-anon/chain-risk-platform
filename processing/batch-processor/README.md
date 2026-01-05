# Batch Processor - Lambda Architecture Batch Layer

> Batch processing with Apache Spark for data archival and correction

## 🎯 Overview

Part of the Lambda Architecture **Batch Layer**, this module provides:

1. **Archive Job**: Archive cold data from PostgreSQL to Hudi data lake
2. **Correction Job**: Apply batch corrections to historical data in Hudi

This ensures **data durability** and **eventual consistency** in the Lambda Architecture.

---

## 🏗️ Architecture

```
PostgreSQL (Hot Data)
    ↓ Archive Job (daily)
Hudi Data Lake (Cold Data)
    ↓ Correction Job
    ├─ Read historical data
    ├─ Apply risk scoring
    ├─ Update labels/tags
    └─ Write back to Hudi
    ↓
Trino (Query Engine)
```

---

## ✨ Features

### Archive Job
- Archive data older than N days from PostgreSQL to Hudi
- Partition by network and date
- Auto-sync to Hive Metastore for Trino queries
- Delete archived data from PostgreSQL

### Correction Job
- Read historical data from Hudi
- Apply risk scoring (HIGH/MEDIUM/LOW)
- Flag exchange addresses
- Schema evolution support (add new columns)
- Generate correction summary reports

---

## 🛠️ Technology Stack

- **Framework**: Apache Spark 3.5.0 (Java API)
- **Data Lake**: Apache Hudi 0.15.0
- **Storage**: MinIO (S3-compatible)
- **Metastore**: Hive Metastore
- **Query Engine**: Trino
- **Language**: Java 17

---

## 📁 Project Structure

```
batch-processor/
├── src/main/java/com/chainrisk/batch/
│   ├── BatchProcessorApp.java           # Unified entry point
│   ├── job/
│   │   ├── ArchiveToHudiJob.java        # PostgreSQL → Hudi archival
│   │   └── HudiBatchCorrectionJob.java  # Hudi batch correction
│   ├── model/
│   │   └── Transfer.java                # Transfer model
│   └── sink/
│       └── Neo4jBatchWriter.java        # Neo4j writer
├── src/main/resources/
│   └── logback.xml
└── pom.xml
```

---

## 🚀 Quick Start

### Build

```bash
cd processing/batch-processor
mvn clean package -DskipTests -Plocal
```

### Run Archive Job

```bash
# Archive all data (RETENTION_DAYS=0)
./scripts/run-archive-job.sh

# Archive data older than 7 days
RETENTION_DAYS=7 ./scripts/run-archive-job.sh
```

### Run Correction Job

```bash
# Correct all historical data
./scripts/run-batch-correction.sh

# Correct specific date range
START_DATE=2026-01-01 END_DATE=2026-01-03 ./scripts/run-batch-correction.sh
```

### Using Unified Entry Point

```bash
# Archive job
java -jar batch-processor.jar archive

# Correction job
java -jar batch-processor.jar correct
```

---

## ⚙️ Configuration

### Environment Variables

| Variable             | Description                      | Default                       |
| -------------------- | -------------------------------- | ----------------------------- |
| `POSTGRES_HOST`      | PostgreSQL host                  | localhost                     |
| `POSTGRES_PORT`      | PostgreSQL port                  | 15432                         |
| `POSTGRES_DB`        | Database name                    | chainrisk                     |
| `POSTGRES_USER`      | Database user                    | chainrisk                     |
| `POSTGRES_PASSWORD`  | Database password                | chainrisk123                  |
| `MINIO_ENDPOINT`     | MinIO endpoint                   | http://localhost:19000        |
| `MINIO_ACCESS_KEY`   | MinIO access key                 | minioadmin                    |
| `MINIO_SECRET_KEY`   | MinIO secret key                 | minioadmin123                 |
| `HUDI_BASE_PATH`     | Hudi storage path                | s3a://chainrisk-datalake/hudi |
| `HIVE_METASTORE_URI` | Hive Metastore URI               | thrift://localhost:19083      |
| `SPARK_MASTER`       | Spark master URL                 | local[*]                      |
| `RETENTION_DAYS`     | Days to keep in PostgreSQL       | 7                             |
| `START_DATE`         | Correction start date (optional) | -                             |
| `END_DATE`           | Correction end date (optional)   | -                             |

---

## 📊 Data Flow

### Archive Job

```
PostgreSQL                    Hudi (MinIO)
┌─────────────────┐          ┌─────────────────┐
│ transfers       │          │ transfers/      │
│ (timestamp < N) │ ──────►  │ network=eth/    │
│                 │          │   dt=2026-01-01/│
└─────────────────┘          └─────────────────┘
        │                            │
        ▼                            ▼
    DELETE                    Hive Metastore
```

### Correction Job

```
Hudi (Read)                   Hudi (Write)
┌─────────────────┐          ┌─────────────────┐
│ transfers       │          │ transfers       │
│ - tx_hash       │          │ + risk_score    │
│ - from_address  │ ──────►  │ + risk_category │
│ - to_address    │          │ + is_exchange   │
│ - value         │          │ + correction_*  │
└─────────────────┘          └─────────────────┘
```

---

## 🔍 Verification

### Check Archived Data in Hudi

```bash
./scripts/trino-query.sh "SELECT count(*) FROM hudi.chainrisk.transfers"
./scripts/trino-query.sh "SELECT network, dt, count(*) FROM hudi.chainrisk.transfers GROUP BY network, dt"
```

### Check Correction Results

```bash
./scripts/trino-query.sh "SELECT risk_category, count(*) FROM hudi.chainrisk.transfers GROUP BY risk_category"
./scripts/trino-query.sh "SELECT * FROM hudi.chainrisk.transfers WHERE risk_score >= 70 LIMIT 10"
```

### Check MinIO Storage

```bash
docker exec minio mc ls -r local/chainrisk-datalake/hudi/
```

---

## 📅 Scheduling

### Cron (Simple)

```bash
# Daily at 2 AM: Archive cold data
0 2 * * * /path/to/scripts/run-archive-job.sh >> /var/log/archive.log 2>&1

# Daily at 3 AM: Run batch correction
0 3 * * * /path/to/scripts/run-batch-correction.sh >> /var/log/correction.log 2>&1
```

### Airflow DAG (Recommended)

```python
from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'chainrisk',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'lambda_batch_layer',
    default_args=default_args,
    schedule_interval='0 2 * * *',
    start_date=datetime(2026, 1, 1),
    catchup=False,
) as dag:

    archive = BashOperator(
        task_id='archive_to_hudi',
        bash_command='./scripts/run-archive-job.sh',
    )

    correct = BashOperator(
        task_id='batch_correction',
        bash_command='./scripts/run-batch-correction.sh',
    )

    archive >> correct
```

---

## 📚 Related Documentation

- [Lambda Architecture Overview](../../docs/architecture/LAMBDA_ARCHITECTURE.md)
- [Technical Decisions](../../docs/architecture/TECH_DECISIONS.md)
- [Project Overview](../../docs/architecture/PROJECT_OVERVIEW.md)

---

**Last Updated**: 2026-01-05
