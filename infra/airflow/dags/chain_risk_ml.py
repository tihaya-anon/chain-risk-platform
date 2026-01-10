"""
Chain Risk Platform - ML Feature DAG
Daily ML feature computation pipeline

Schedule: 04:00 UTC daily (after archive DAG completes)
Tasks: wait_for_correction → features → training
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.sensors.external_task import ExternalTaskSensor

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
    'chain_risk_ml',
    default_args=default_args,
    description='Daily ML feature computation (after correction)',
    schedule_interval='0 4 * * *',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'daily', 'ml'],
    max_active_runs=1,
) as dag:

    # Wait for archive DAG correction task to complete
    wait_for_correction = ExternalTaskSensor(
        task_id='wait_for_correction',
        external_dag_id='chain_risk_archive',
        external_task_id='batch_correction',
        execution_delta=timedelta(hours=2),  # archive runs at 02:00, this at 04:00
        timeout=3600,
        poke_interval=60,
        mode='reschedule',
    )

    features = BashOperator(
        task_id='compute_features',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} features',
    )

    training = BashOperator(
        task_id='prepare_training',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} training',
    )

    wait_for_correction >> features >> training
