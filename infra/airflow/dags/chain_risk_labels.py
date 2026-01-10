"""
Chain Risk Platform - Labels DAG
Weekly label data refresh

Schedule: 01:00 UTC every Sunday
Tasks: labels → training
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

DOCKER_RUN = """
docker run --rm --network host \
  -v /home/smsmu/chain-risk-platform/processing/batch-processor/target:/app \
  -e POSTGRES_HOST=172.17.0.1 -e POSTGRES_PORT=15432 \
  -e POSTGRES_DB=chainrisk -e POSTGRES_USER=chainrisk -e POSTGRES_PASSWORD=chainrisk123 \
  -e MINIO_ENDPOINT=http://172.17.0.1:19000 \
  -e MINIO_ACCESS_KEY=minioadmin -e MINIO_SECRET_KEY=minioadmin123 \
  -e HUDI_BASE_PATH=s3a://chainrisk-datalake/hudi \
  -e NEO4J_URI=bolt://172.17.0.1:17687 -e NEO4J_USER=neo4j -e NEO4J_PASSWORD=chainrisk123 \
  -e NETWORK=ethereum \
  -e USE_MOCK_LABELS=true \
  eclipse-temurin:17-jre java \
  --add-opens=java.base/java.lang=ALL-UNNAMED \
  --add-opens=java.base/java.lang.invoke=ALL-UNNAMED \
  --add-opens=java.base/java.lang.reflect=ALL-UNNAMED \
  --add-opens=java.base/java.io=ALL-UNNAMED \
  --add-opens=java.base/java.net=ALL-UNNAMED \
  --add-opens=java.base/java.nio=ALL-UNNAMED \
  --add-opens=java.base/java.util=ALL-UNNAMED \
  --add-opens=java.base/java.util.concurrent=ALL-UNNAMED \
  --add-opens=java.base/java.util.concurrent.atomic=ALL-UNNAMED \
  --add-opens=java.base/sun.nio.ch=ALL-UNNAMED \
  --add-opens=java.base/sun.nio.cs=ALL-UNNAMED \
  --add-opens=java.base/sun.security.action=ALL-UNNAMED \
  --add-opens=java.base/sun.util.calendar=ALL-UNNAMED \
  --add-opens=java.security.jgss/sun.security.krb5=ALL-UNNAMED \
  -jar /app/batch-processor-1.0.0-SNAPSHOT.jar {job}
"""

default_args = {
    'owner': 'chainrisk',
    'retries': 2,
    'retry_delay': timedelta(minutes=10),
    'email_on_failure': False,
}

with DAG(
    'chain_risk_labels',
    default_args=default_args,
    description='Weekly label refresh (OFAC, Tornado Cash, Exchanges)',
    schedule_interval='0 1 * * 0',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'weekly', 'labels'],
    max_active_runs=1,
) as dag:

    labels = BashOperator(
        task_id='ingest_labels',
        bash_command=DOCKER_RUN.format(job='labels'),
    )

    training = BashOperator(
        task_id='regenerate_training',
        bash_command=DOCKER_RUN.format(job='training'),
    )

    labels >> training
