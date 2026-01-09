# Airflow Integration Plan

> Orchestrate batch processing jobs with Apache Airflow

**Date**: 2026-01-09  
**Status**: 📋 Planning

---

## Overview

Integrate Apache Airflow to orchestrate batch processing jobs with proper dependency management, scheduling, and monitoring.

---

## Batch Jobs Inventory

| Job | Command | Input | Output |
|-----|---------|-------|--------|
| archive | `batch-archive` | PostgreSQL (cold data) | Hudi transfers |
| correct | `batch-correct` | Hudi transfers | Hudi transfers (with risk_score) |
| features | `batch-features` | Hudi transfers | Hudi address_features |
| labels | `batch-labels` | Public APIs | Hudi address_labels |
| training | `batch-training` | address_features + address_labels | Hudi training_dataset |
| neo4j | `batch-neo4j` | Hudi transfers | Neo4j graph |

---

## DAG Design

### DAG 1: Daily Data Pipeline (`chain_risk_daily`)

Runs daily at 02:00 UTC.

```
                    ┌─────────────┐
                    │   archive   │
                    │  (02:00)    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ correct  │ │ features │ │  neo4j   │
        └──────────┘ └────┬─────┘ └──────────┘
                          │
                          ▼
                    ┌──────────┐
                    │ training │
                    └──────────┘
```

**Dependency Logic**:
- `archive` runs first (PostgreSQL → Hudi)
- After archive completes:
  - `correct`: apply risk scoring
  - `features`: compute ML features
  - `neo4j`: sync to graph DB
- `training` waits for `features` (labels ingested separately)

### DAG 2: Weekly Label Refresh (`chain_risk_labels`)

Runs weekly on Sunday at 01:00 UTC.

```
┌──────────┐     ┌──────────┐
│  labels  │ ──▶ │ training │
└──────────┘     └──────────┘
```

**Note**: `training` also in daily DAG, but weekly refresh ensures label updates propagate.

---

## Implementation Tasks

### Phase 1: Infrastructure

| Task | Description |
|------|-------------|
| 1.1 | Add Airflow to docker-compose (webserver, scheduler, worker) |
| 1.2 | Configure PostgreSQL as Airflow metadata DB |
| 1.3 | Configure connections (Spark, PostgreSQL, MinIO, Neo4j) |
| 1.4 | Set up Airflow variables for environment config |

### Phase 2: DAG Development

| Task | Description |
|------|-------------|
| 2.1 | Create `chain_risk_daily` DAG |
| 2.2 | Create `chain_risk_labels` DAG |
| 2.3 | Implement SparkSubmitOperator for batch jobs |
| 2.4 | Add alerting on failure (Slack/Email) |

### Phase 3: Operations

| Task | Description |
|------|-------------|
| 3.1 | Add Grafana dashboard for Airflow metrics |
| 3.2 | Document runbook for DAG operations |
| 3.3 | E2E test for full pipeline execution |

---

## Technical Decisions

### Airflow Executor

**CeleryExecutor** for production (scalable), **LocalExecutor** for development.

### Operator Choice

**SparkSubmitOperator** via `apache-airflow-providers-apache-spark`:
- Submits to Spark standalone/YARN/K8s
- Handles logging and status tracking

Alternative: **BashOperator** with `make batch-*` commands (simpler, less monitoring).

### Retry Strategy

```python
default_args = {
    'retries': 2,
    'retry_delay': timedelta(minutes=10),
    'retry_exponential_backoff': True,
}
```

### Alerting

```python
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator

def notify_failure(context):
    SlackWebhookOperator(
        task_id='slack_alert',
        slack_webhook_conn_id='slack_default',
        message=f"Task {context['task_instance'].task_id} failed",
    ).execute(context)
```

---

## File Structure

```
infra/
└── airflow/
    ├── docker-compose.airflow.yml
    ├── Dockerfile
    ├── requirements.txt
    └── dags/
        ├── chain_risk_daily.py
        └── chain_risk_labels.py

scripts/
└── airflow-init.sh
```

---

## docker-compose Addition

```yaml
# infra/airflow/docker-compose.airflow.yml
services:
  airflow-webserver:
    image: apache/airflow:2.8.0
    environment:
      AIRFLOW__CORE__EXECUTOR: LocalExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres:5432/airflow
    ports:
      - "18082:8080"
    volumes:
      - ./dags:/opt/airflow/dags
      - ./logs:/opt/airflow/logs
    depends_on:
      - postgres

  airflow-scheduler:
    image: apache/airflow:2.8.0
    command: scheduler
    volumes:
      - ./dags:/opt/airflow/dags
      - ./logs:/opt/airflow/logs
```

---

## DAG Code (Draft)

```python
# dags/chain_risk_daily.py
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
    'chain_risk_daily',
    default_args=default_args,
    description='Daily batch processing pipeline',
    schedule_interval='0 2 * * *',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'daily'],
) as dag:

    archive = BashOperator(
        task_id='archive_to_hudi',
        bash_command=f'cd {PROJECT_ROOT} && make batch-archive',
    )

    correct = BashOperator(
        task_id='batch_correction',
        bash_command=f'cd {PROJECT_ROOT} && make batch-correct',
    )

    features = BashOperator(
        task_id='compute_features',
        bash_command=f'cd {PROJECT_ROOT} && make batch-features',
    )

    neo4j_sync = BashOperator(
        task_id='neo4j_sync',
        bash_command=f'cd {PROJECT_ROOT} && make batch-neo4j',
    )

    training = BashOperator(
        task_id='prepare_training',
        bash_command=f'cd {PROJECT_ROOT} && make batch-training',
    )

    # Dependencies
    archive >> [correct, features, neo4j_sync]
    features >> training
```

---

## Schedule Summary

| DAG | Schedule | Duration (est.) |
|-----|----------|-----------------|
| chain_risk_daily | 02:00 UTC daily | ~30-60 min |
| chain_risk_labels | 01:00 UTC Sunday | ~10 min |

---

## Success Criteria

- [ ] Airflow UI accessible at `:18082`
- [ ] DAGs visible and schedulable
- [ ] Archive → Correct/Features/Neo4j → Training executes in order
- [ ] Failure alerts sent to configured channel
- [ ] Grafana dashboard shows DAG metrics

---

## References

- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
- [Hudi Batch Layer](./HUDI_BATCH_LAYER.md)
- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
- [Data Retention Policy](../operations/DATA_RETENTION_POLICY.md)
