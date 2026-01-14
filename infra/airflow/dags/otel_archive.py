"""
OTel Archive DAG: Daily archival of OpenTelemetry data to Hudi data lake.

Schedule: Daily at 01:00 UTC
Data Flow: Kafka (otel-*) -> Spark -> Hudi -> Hive Metastore

This DAG supports ML training pipelines by providing 3-6 months of historical
observability data for anomaly detection models.
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.python import PythonOperator
from airflow.sensors.external_task import ExternalTaskSensor

default_args = {
    "owner": "sre-team",
    "depends_on_past": False,
    "email": ["sre@chainrisk.io"],
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
    "execution_timeout": timedelta(hours=2),
}

SPARK_CONN_ID = "spark_default"
JAR_PATH = "/opt/spark/jars/batch-processor.jar"

with DAG(
    dag_id="otel_archive",
    default_args=default_args,
    description="Archive OTel data from Kafka to Hudi for ML training",
    schedule_interval="0 1 * * *",  # Daily at 01:00 UTC
    start_date=datetime(2026, 1, 14),
    catchup=False,
    tags=["otel", "archive", "hudi", "phase17"],
    max_active_runs=1,
) as dag:

    def validate_kafka_topics(**context):
        """Validate Kafka topics have data to archive."""
        from kafka import KafkaConsumer
        from kafka.errors import NoBrokersAvailable
        import os

        bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        topics = ["otel-metrics", "otel-logs", "otel-traces"]
        
        try:
            consumer = KafkaConsumer(
                bootstrap_servers=bootstrap,
                consumer_timeout_ms=5000
            )
            existing = consumer.topics()
            consumer.close()
            
            missing = [t for t in topics if t not in existing]
            if missing:
                raise ValueError(f"Missing Kafka topics: {missing}")
            
            return {"status": "ok", "topics": topics}
        except NoBrokersAvailable:
            raise RuntimeError("Kafka brokers unavailable")

    validate_topics = PythonOperator(
        task_id="validate_kafka_topics",
        python_callable=validate_kafka_topics,
    )

    archive_metrics = SparkSubmitOperator(
        task_id="archive_otel_metrics",
        conn_id=SPARK_CONN_ID,
        application=JAR_PATH,
        java_class="com.chainrisk.batch.job.OTelArchiveJob",
        application_args=["metrics"],
        conf={
            "spark.executor.memory": "2g",
            "spark.executor.cores": "2",
            "spark.dynamicAllocation.enabled": "true",
            "spark.dynamicAllocation.minExecutors": "1",
            "spark.dynamicAllocation.maxExecutors": "4",
        },
        name="otel-archive-metrics",
    )

    archive_logs = SparkSubmitOperator(
        task_id="archive_otel_logs",
        conn_id=SPARK_CONN_ID,
        application=JAR_PATH,
        java_class="com.chainrisk.batch.job.OTelArchiveJob",
        application_args=["logs"],
        conf={
            "spark.executor.memory": "2g",
            "spark.executor.cores": "2",
            "spark.dynamicAllocation.enabled": "true",
            "spark.dynamicAllocation.minExecutors": "1",
            "spark.dynamicAllocation.maxExecutors": "4",
        },
        name="otel-archive-logs",
    )

    archive_traces = SparkSubmitOperator(
        task_id="archive_otel_traces",
        conn_id=SPARK_CONN_ID,
        application=JAR_PATH,
        java_class="com.chainrisk.batch.job.OTelArchiveJob",
        application_args=["traces"],
        conf={
            "spark.executor.memory": "2g",
            "spark.executor.cores": "2",
            "spark.dynamicAllocation.enabled": "true",
            "spark.dynamicAllocation.minExecutors": "1",
            "spark.dynamicAllocation.maxExecutors": "4",
        },
        name="otel-archive-traces",
    )

    def verify_hudi_tables(**context):
        """Verify Hudi tables are updated."""
        from pyspark.sql import SparkSession
        import os

        hudi_base = os.getenv("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi")
        tables = ["otel_metrics", "otel_logs", "otel_traces"]
        
        spark = SparkSession.builder \
            .appName("otel-archive-verify") \
            .config("spark.sql.extensions", 
                    "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
            .getOrCreate()
        
        results = {}
        for table in tables:
            path = f"{hudi_base}/otel/{table}"
            try:
                df = spark.read.format("hudi").load(path)
                count = df.count()
                results[table] = {"status": "ok", "count": count}
            except Exception as e:
                results[table] = {"status": "error", "error": str(e)}
        
        spark.stop()
        return results

    verify_tables = PythonOperator(
        task_id="verify_hudi_tables",
        python_callable=verify_hudi_tables,
    )

    # Task dependencies: validate -> parallel archives -> verify
    validate_topics >> [archive_metrics, archive_logs, archive_traces] >> verify_tables
