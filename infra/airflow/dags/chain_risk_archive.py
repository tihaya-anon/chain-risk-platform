"""
Chain Risk Platform - Archive DAG
Daily archive and correction pipeline

Schedule: 02:00 UTC daily
Tasks: archive → correct → neo4j
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

# Java 17 module opens for Spark
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
    'chain_risk_archive',
    default_args=default_args,
    description='Daily archive PostgreSQL → Hudi → Neo4j',
    schedule_interval='0 2 * * *',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['batch', 'daily', 'archive'],
    max_active_runs=1,
) as dag:

    archive = BashOperator(
        task_id='archive_to_hudi',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} archive',
    )

    correct = BashOperator(
        task_id='batch_correction',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} correct',
    )

    neo4j_sync = BashOperator(
        task_id='neo4j_sync',
        bash_command=f'java {JAVA_OPTS} -jar {JAR_PATH} neo4j',
    )

    archive >> correct >> neo4j_sync
