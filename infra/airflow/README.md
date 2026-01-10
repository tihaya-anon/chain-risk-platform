# Airflow Integration

Apache Airflow orchestrates batch processing jobs with proper dependency management.

## Quick Start

```bash
# From project root
cd infra/airflow

# Set UID (Linux only, skip on Mac/Windows)
echo "AIRFLOW_UID=$(id -u)" >> .env

# Start Airflow
docker-compose up -d

# Access UI: http://localhost:18080
# Login: admin / admin
```

## DAGs

| DAG | Schedule | Description |
|-----|----------|-------------|
| `chain_risk_archive` | 02:00 daily | archive → correct → neo4j |
| `chain_risk_ml` | 04:00 daily | features → training (waits for correction) |
| `chain_risk_labels` | 01:00 Sunday | labels → training |

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         chain_risk_archive          │
                    │              02:00 UTC              │
                    │                                     │
                    │  archive ──▶ correct ──▶ neo4j     │
                    │                                     │
                    └────────────────┬────────────────────┘
                                     │
                         ExternalTaskSensor
                                     ▼
                    ┌─────────────────────────────────────┐
                    │           chain_risk_ml             │
                    │              04:00 UTC              │
                    │                                     │
                    │     features ──▶ training           │
                    │                                     │
                    └─────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         chain_risk_labels           │
                    │           Sunday 01:00 UTC          │
                    │                                     │
                    │       labels ──▶ training           │
                    │                                     │
                    └─────────────────────────────────────┘
```

## Manual Trigger

```bash
# Trigger DAG run
docker exec airflow-scheduler airflow dags trigger chain_risk_archive

# List DAG runs
docker exec airflow-scheduler airflow dags list-runs -d chain_risk_archive
```

## Logs

```bash
# View scheduler logs
docker logs -f airflow-scheduler

# View task logs
docker exec airflow-scheduler airflow tasks logs chain_risk_archive archive_to_hudi 2026-01-10
```

## Environment Variables

DAGs inherit these from docker-compose:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | host.docker.internal | PostgreSQL host |
| `POSTGRES_PORT` | 15432 | PostgreSQL port |
| `MINIO_ENDPOINT` | http://...:19000 | MinIO endpoint |
| `HUDI_BASE_PATH` | s3a://chainrisk-datalake/hudi | Hudi base path |
| `NEO4J_URI` | bolt://...:17687 | Neo4j connection |

## Troubleshooting

### DAG not appearing
```bash
# Check for syntax errors
docker exec airflow-scheduler airflow dags list
docker exec airflow-scheduler python /opt/airflow/dags/chain_risk_archive.py
```

### Task failed
```bash
# View task logs
docker exec airflow-scheduler airflow tasks logs <dag_id> <task_id> <execution_date>

# Clear failed task for retry
docker exec airflow-scheduler airflow tasks clear <dag_id> -t <task_id> -s <start_date> -e <end_date>
```
