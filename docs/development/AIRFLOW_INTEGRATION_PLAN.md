# Airflow Integration Plan

> Orchestrate batch processing jobs with Apache Airflow

**Date**: 2026-01-09  
**Status**: 📋 Planning

---

## Overview

Integrate Apache Airflow to orchestrate batch processing jobs with proper dependency management.

---

## Speed Layer vs Batch Layer

### Flink Speed Layer (Real-time)

```
Kafka → Flink → PostgreSQL (source='stream')
                     │
                     └→ Neo4j (via stream, optional)
```

**Limitations**:
- `confirmations = 12` blocks, but reorgs still possible
- Limited window size for aggregations
- Simple rule-based processing only
- No complex ML scoring

### Spark Batch Layer (Correction)

```
PostgreSQL (cold) → archive → Hudi
                               │
Hudi → correct → Hudi (risk_score, labels applied)
```

**Purpose of Correction Job**:
1. Handle block reorg inconsistencies
2. Recalculate risk scores with updated rules
3. Apply retroactive address labels/tags
4. Fix data quality issues from stream processing

---

## Batch Jobs Inventory

| Job | Input | Output | Purpose |
|-----|-------|--------|---------|
| **archive** | PostgreSQL (cold) | Hudi transfers | Move old data to data lake |
| **correct** | Hudi transfers | Hudi transfers (+corrections) | Fix stream layer inaccuracies |
| **features** | Hudi transfers | Hudi address_features | Compute ML features |
| **labels** | Public APIs | Hudi address_labels | Ingest OFAC/mixer/exchange labels |
| **training** | features + labels | Hudi training_dataset | Prepare ML training data |
| **neo4j** | Hudi transfers | Neo4j graph | Sync corrected data to graph |

---

## DAG Design

### DAG 1: Daily Archive + Correction (`chain_risk_archive`)

**Schedule**: Daily 02:00 UTC

```
┌──────────┐
│ archive  │  PostgreSQL → Hudi
└────┬─────┘
     │
     ▼
┌──────────┐
│ correct  │  Apply risk scores, handle reorgs
└────┬─────┘
     │
     ▼
┌──────────┐
│  neo4j   │  Sync corrected data to graph
└──────────┘
```

**Rationale**: 
- `archive` moves cold data to Hudi first
- `correct` fixes stream inaccuracies on archived data
- `neo4j` syncs corrected (not raw) data to graph DB

### DAG 2: ML Feature Pipeline (`chain_risk_ml`)

**Schedule**: Daily 04:00 UTC (after archive+correct)

```
┌──────────┐
│ features │  Compute from corrected Hudi data
└────┬─────┘
     │
     ▼
┌──────────┐
│ training │  Join with labels
└──────────┘
```

**Rationale**:
- Features computed from **corrected** Hudi data (not raw stream data)
- Runs after correction completes

### DAG 3: Weekly Label Refresh (`chain_risk_labels`)

**Schedule**: Weekly Sunday 01:00 UTC

```
┌──────────┐
│  labels  │  Fetch from OFAC, Tornado Cash, Exchanges
└────┬─────┘
     │
     ▼
┌──────────┐
│ training │  Regenerate training dataset
└──────────┘
```

**Rationale**:
- Labels change infrequently (sanctions lists, new exchanges)
- Weekly refresh sufficient

---

## Dependency Summary

```
             ┌─────────────────────────────────────────────────────────┐
             │                    DAG 1 (02:00)                        │
             │                                                         │
             │  archive ──▶ correct ──▶ neo4j                         │
             │                                                         │
             └─────────────────────────┬───────────────────────────────┘
                                       │
                                       │ ExternalTaskSensor
                                       ▼
             ┌─────────────────────────────────────────────────────────┐
             │                    DAG 2 (04:00)                        │
             │                                                         │
             │  features ──▶ training                                  │
             │                                                         │
             └─────────────────────────────────────────────────────────┘

             ┌─────────────────────────────────────────────────────────┐
             │                  DAG 3 (Sunday 01:00)                   │
             │                                                         │
             │  labels ──▶ training                                    │
             │                                                         │
             └─────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Infrastructure

| Task | Description |
|------|-------------|
| 1.1 | Add Airflow to docker-compose |
| 1.2 | Configure Airflow metadata DB (separate PostgreSQL DB or SQLite for dev) |
| 1.3 | Set up Airflow connections (Spark submit, env vars) |
| 1.4 | Mount project directory for batch scripts |

### Phase 2: DAG Development

| Task | Description |
|------|-------------|
| 2.1 | Create `chain_risk_archive` DAG |
| 2.2 | Create `chain_risk_ml` DAG with ExternalTaskSensor |
| 2.3 | Create `chain_risk_labels` DAG |
| 2.4 | Add failure alerting |

### Phase 3: Operations

| Task | Description |
|------|-------------|
| 3.1 | Add Airflow metrics to Prometheus |
| 3.2 | Create Grafana dashboard for DAG monitoring |
| 3.3 | Document runbook |

---

## File Structure

```
infra/airflow/
├── docker-compose.airflow.yml
├── Dockerfile
├── requirements.txt
└── dags/
    ├── chain_risk_archive.py
    ├── chain_risk_ml.py
    └── chain_risk_labels.py
```

---

## DAG Code (Draft)

### chain_risk_archive.py

```python
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

PROJECT_ROOT = "/opt/chainrisk"

default_args = {
    'owner': 'chainrisk',
    'retries': 2,
    'retry_delay': timedelta(minutes=10),
}

with DAG(
    'chain_risk_archive',
    default_args=default_args,
    description='Daily archive and correction pipeline',
    schedule_interval='0 2 * * *',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'daily', 'archive'],
) as dag:

    archive = BashOperator(
        task_id='archive_to_hudi',
        bash_command=f'cd {PROJECT_ROOT} && make batch-archive',
    )

    correct = BashOperator(
        task_id='batch_correction',
        bash_command=f'cd {PROJECT_ROOT} && make batch-correct',
    )

    neo4j_sync = BashOperator(
        task_id='neo4j_sync',
        bash_command=f'cd {PROJECT_ROOT} && make batch-neo4j',
    )

    archive >> correct >> neo4j_sync
```

### chain_risk_ml.py

```python
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.sensors.external_task import ExternalTaskSensor

PROJECT_ROOT = "/opt/chainrisk"

default_args = {
    'owner': 'chainrisk',
    'retries': 2,
    'retry_delay': timedelta(minutes=10),
}

with DAG(
    'chain_risk_ml',
    default_args=default_args,
    description='ML feature pipeline (after correction)',
    schedule_interval='0 4 * * *',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'daily', 'ml'],
) as dag:

    # Wait for archive DAG to complete
    wait_for_correction = ExternalTaskSensor(
        task_id='wait_for_correction',
        external_dag_id='chain_risk_archive',
        external_task_id='batch_correction',
        execution_delta=timedelta(hours=2),  # DAG 1 runs at 02:00, DAG 2 at 04:00
        timeout=3600,
        poke_interval=60,
    )

    features = BashOperator(
        task_id='compute_features',
        bash_command=f'cd {PROJECT_ROOT} && make batch-features',
    )

    training = BashOperator(
        task_id='prepare_training',
        bash_command=f'cd {PROJECT_ROOT} && make batch-training',
    )

    wait_for_correction >> features >> training
```

---

## Schedule Summary

| DAG | Schedule | Est. Duration | Depends On |
|-----|----------|---------------|------------|
| chain_risk_archive | 02:00 daily | 30-60 min | - |
| chain_risk_ml | 04:00 daily | 20-30 min | archive.correct |
| chain_risk_labels | 01:00 Sunday | 10 min | - |

---

## Current Correction Job Simplification

The current `HudiBatchCorrectionJob` is simplified for MVP:
- Risk score based on transfer value thresholds only
- Hardcoded exchange addresses
- No actual reorg detection

**Future Enhancements**:
- Query address_labels for dynamic label lookup
- Compare stream vs archive data for reorg detection
- Integrate with Risk ML Service for scoring

---

## Success Criteria

- [ ] Airflow UI accessible
- [ ] DAGs visible and properly scheduled
- [ ] archive → correct → neo4j executes in sequence
- [ ] features waits for correct completion
- [ ] Failure alerts configured

---

## References

- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
- [Hudi Batch Layer](./HUDI_BATCH_LAYER.md)
- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
