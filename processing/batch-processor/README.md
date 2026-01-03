# Batch Processor - Lambda Architecture Batch Layer

> Daily batch processing with Apache Spark - Correct and overwrite stream data

## 🎯 Overview

Part of the Lambda Architecture **Batch Layer**, this Spark job corrects stream-processed data by:

1. Reading transfers with `source='stream'` from PostgreSQL
2. Applying corrections and validations (in production: re-parse from blockchain RPC)
3. Overwriting with `source='batch'` in PostgreSQL
4. Overwriting with `source='batch'` in Neo4j

This ensures **eventual consistency** and **data accuracy** in the Lambda Architecture.

---

## 🏗️ Architecture

```
PostgreSQL (source='stream')
    ↓
Spark Batch Processor
    ├─ Read stream transfers
    ├─ Apply corrections
    └─ Validate data
    ↓
    ├─────────┬─────────┐
    │         │         │
    ▼         ▼         ▼
PostgreSQL  Neo4j   Metrics
(UPSERT)    (MERGE) (Logging)
source=     source=
'batch'     'batch'
```

---

## ✨ Features

### Correction Strategy
- **Read**: Fetch transfers with `source='stream'`
- **Correct**: Apply validations (in production: re-parse from blockchain)
- **Overwrite**: UPSERT to PostgreSQL, MERGE to Neo4j with `source='batch'`

### Data Validation
In production, this job would:
- ✅ Re-fetch blocks from blockchain RPC
- ✅ Re-parse transaction logs
- ✅ Handle block reorgs
- ✅ Process complex contracts
- ✅ Validate addresses
- ✅ Calculate global features

For now (MVP), it:
- ✅ Reads stream data from PostgreSQL
- ✅ Marks as corrected with `source='batch'`
- ✅ Demonstrates the Lambda pattern

### Fault Tolerance
- Spark checkpointing and retries
- Per-partition error handling
- Batch commit (1000 records)

---

## 🛠️ Technology Stack

- **Framework**: Apache Spark 3.5.0 (Java API)
- **Language**: Java 17
- **Databases**: PostgreSQL, Neo4j
- **Driver**: Neo4j Java Driver 5.14.0

---

## 📁 Project Structure

```
batch-processor/
├── src/main/java/com/chainrisk/batch/
│   ├── BatchProcessorApp.java        # Application entry
│   ├── job/
│   │   └── TransferCorrectionJob.java # Main Spark job
│   ├── model/
│   │   └── Transfer.java             # Transfer model
│   └── sink/
│       └── Neo4jBatchWriter.java     # Neo4j writer
├── src/main/resources/
│   ├── application.properties        # Configuration
│   └── sql/
│       └── .gitkeep
└── pom.xml
```

---

## 🚀 Quick Start

### Build

```bash
cd processing/batch-processor
mvn clean package -DskipTests
```

### Run Locally

```bash
# With default configuration
spark-submit \
  --class com.chainrisk.batch.BatchProcessorApp \
  --master local[*] \
  target/batch-processor-1.0.0-SNAPSHOT.jar

# With custom configuration
spark-submit \
  --class com.chainrisk.batch.BatchProcessorApp \
  --master local[*] \
  --driver-memory 2g \
  --executor-memory 2g \
  target/batch-processor-1.0.0-SNAPSHOT.jar \
  --jdbc.url jdbc:postgresql://100.120.144.128:15432/chainrisk \
  --neo4j.uri bolt://100.120.144.128:17687
```

### Run on Spark Cluster

```bash
spark-submit \
  --class com.chainrisk.batch.BatchProcessorApp \
  --master spark://master:7077 \
  --deploy-mode cluster \
  --driver-memory 2g \
  --executor-memory 4g \
  --num-executors 10 \
  target/batch-processor-1.0.0-SNAPSHOT.jar \
  --jdbc.url jdbc:postgresql://postgres:5432/chainrisk \
  --neo4j.uri bolt://neo4j:7687
```

---

## ⚙️ Configuration

### PostgreSQL Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `jdbc.url` | PostgreSQL JDBC URL | jdbc:postgresql://localhost:15432/chainrisk |
| `jdbc.user` | Database user | chainrisk |
| `jdbc.password` | Database password | chainrisk123 |

### Neo4j Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `neo4j.uri` | Neo4j Bolt URI | bolt://localhost:17687 |
| `neo4j.user` | Neo4j user | neo4j |
| `neo4j.password` | Neo4j password | chainrisk123 |

### Job Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `network` | Network to process | ethereum |
| `enable.neo4j.sink` | Enable Neo4j writes | true |

---

## 📊 Data Flow

### Input (PostgreSQL)

```sql
SELECT * FROM chain_data.transfers 
WHERE source = 'stream' AND network = 'ethereum';
```

### Processing

```java
// Read stream transfers
Dataset<Row> streamTransfers = spark.read().jdbc(...);

// Apply corrections
Dataset<Row> corrected = streamTransfers
    .withColumn("source", lit("batch"))
    .withColumn("corrected_at", current_timestamp());
```

### Output 1: PostgreSQL (UPSERT)

```sql
INSERT INTO chain_data.transfers (...)
VALUES (...)
ON CONFLICT (tx_hash, log_index) DO UPDATE SET
  source = 'batch',
  corrected_at = NOW(),
  ...
```

### Output 2: Neo4j (MERGE)

```cypher
// Update Address nodes
MERGE (from:Address {address: $fromAddr, network: $network})
ON MATCH SET from.source = 'batch', from.corrected_at = timestamp()

// Update TRANSFER relationships
MERGE (from)-[r:TRANSFER {tx_hash: $txHash}]->(to)
ON MATCH SET r.source = 'batch', r.corrected_at = timestamp()
```

---

## 🔍 Verification

### Check Corrected Data

```sql
-- PostgreSQL: Check batch corrections
SELECT 
    source,
    COUNT(*) as count,
    MIN(corrected_at) as first_correction,
    MAX(corrected_at) as last_correction
FROM chain_data.transfers
GROUP BY source;
```

```cypher
// Neo4j: Check batch corrections
MATCH ()-[r:TRANSFER]->()
RETURN r.source as source, count(r) as count;
```

---

## 🧪 Testing

### Unit Tests

```bash
mvn test -pl batch-processor
```

### Integration Test

```bash
# 1. Run Phase 1 (data ingestion)
make test-integration-phase1

# 2. Run Flink stream processor
make test-integration-phase2

# 3. Run Spark batch processor
./scripts/run-spark-batch.sh
```

---

## 🐛 Troubleshooting

### Spark Submit Fails

```bash
# Check Spark is installed
spark-submit --version

# Check Java version
java -version  # Should be 17+
```

### PostgreSQL Connection Failed

```bash
# Test connection
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk -c "SELECT 1"
```

### Neo4j Connection Failed

```bash
# Test connection
cypher-shell -a bolt://100.120.144.128:17687 -u neo4j -p chainrisk123 "RETURN 1"
```

### No Stream Data Found

```bash
# Check if stream data exists
PGPASSWORD=chainrisk123 psql -h 100.120.144.128 -p 15432 -U chainrisk -d chainrisk \
  -c "SELECT COUNT(*) FROM chain_data.transfers WHERE source='stream'"
```

---

## 📅 Scheduling

### Airflow DAG (Recommended)

```python
from airflow import DAG
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'chainrisk',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'lambda_batch_correction',
    default_args=default_args,
    description='Lambda Batch Layer - Daily Transfer Correction',
    schedule_interval='0 2 * * *',  # Daily at 2 AM
    catchup=False,
)

transfer_correction = SparkSubmitOperator(
    task_id='transfer_correction',
    application='/path/to/batch-processor-1.0.0-SNAPSHOT.jar',
    java_class='com.chainrisk.batch.BatchProcessorApp',
    conf={
        'spark.executor.memory': '4g',
        'spark.driver.memory': '2g',
        'spark.executor.cores': '2',
        'spark.executor.instances': '10',
    },
    application_args=[
        '--jdbc.url', 'jdbc:postgresql://postgres:5432/chainrisk',
        '--neo4j.uri', 'bolt://neo4j:7687',
    ],
    dag=dag,
)
```

### Cron (Simple)

```bash
# Add to crontab
0 2 * * * /path/to/scripts/run-spark-batch.sh >> /var/log/batch-processor.log 2>&1
```

---

## 📚 Related Documentation

- [Lambda Architecture Overview](../../docs/architecture/LAMBDA_ARCHITECTURE.md)
- [Project Overview](../../docs/architecture/PROJECT_OVERVIEW.md)
- [Technical Decisions](../../docs/architecture/TECH_DECISIONS.md)
- [Phase 1 Summary](../../docs/development/PHASE1_SUMMARY.md)

---

**Last Updated**: 2026-01-03
