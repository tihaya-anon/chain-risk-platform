"""
Chain Risk Platform - Labels DAG
Weekly label data refresh

Schedule: 01:00 UTC every Sunday
Tasks: labels → training
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

JAVA_OPTS = (
    "--add-opens=java.base/java.lang=ALL-UNNAMED "
    "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED "
    "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED "
    "--add-opens=java.base/java.io=ALL-UNNAMED "
    "--add-opens=java.base/java.net=ALL-UNNAMED "
    "--add-opens=java.base/java.nio=ALL-UNNAMED "
    "--add-opens=java.base/java.util=ALL-UNNAMED "
    "--add-opens=java.base/java.util.concurrent=ALL-UNNAMED "
    "--add-opens=java.base/java.util.concurrent.atomic=ALL-UNNAMED "
    "--add-opens=java.base/sun.nio.ch=ALL-UNNAMED "
    "--add-opens=java.base/sun.nio.cs=ALL-UNNAMED "
    "--add-opens=java.base/sun.security.action=ALL-UNNAMED "
    "--add-opens=java.base/sun.util.calendar=ALL-UNNAMED "
    "--add-opens=java.security.jgss/sun.security.krb5=ALL-UNNAMED"
)

JAR_PATH = "/opt/batch-processor/batch-processor-1.0.0-SNAPSHOT.jar"

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
    schedule_interval='0 1 * * 0',  # Sunday 01:00 UTC
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'weekly', 'labels'],
    max_active_runs=1,
) as dag:

    labels = BashOperator(
        task_id='ingest_labels',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} labels',
        env={
            'USE_MOCK_LABELS': 'true',  # Use mock in dev, set to 'false' in prod
        },
    )

    training = BashOperator(
        task_id='regenerate_training',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} training',
    )

    labels >> training
