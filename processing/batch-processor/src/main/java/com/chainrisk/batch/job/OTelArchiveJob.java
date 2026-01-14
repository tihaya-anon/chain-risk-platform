package com.chainrisk.batch.job;

import org.apache.hudi.DataSourceWriteOptions;
import org.apache.hudi.config.HoodieWriteConfig;
import org.apache.spark.sql.*;
import org.apache.spark.sql.streaming.StreamingQuery;
import org.apache.spark.sql.types.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * OTel Archive Job: Archives OpenTelemetry data from Kafka to Hudi for ML training.
 * 
 * Data Flow:
 *   Kafka (otel-metrics/logs/traces) → Spark → Hudi (partitioned by service/date)
 * 
 * Usage:
 *   spark-submit --class com.chainrisk.batch.job.OTelArchiveJob \
 *     --master yarn batch-processor.jar [metrics|logs|traces|all]
 */
public class OTelArchiveJob {
    private static final Logger logger = LoggerFactory.getLogger(OTelArchiveJob.class);

    private static final String KAFKA_BOOTSTRAP = System.getenv().getOrDefault(
        "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092");
    private static final String HUDI_BASE_PATH = System.getenv().getOrDefault(
        "HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
    private static final String CHECKPOINT_BASE = System.getenv().getOrDefault(
        "CHECKPOINT_BASE", "s3a://chainrisk-datalake/checkpoints/otel");

    public static void main(String[] args) {
        String mode = args.length > 0 ? args[0] : "all";
        
        SparkSession spark = SparkSession.builder()
            .appName("OTelArchiveJob-" + mode)
            .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
            .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog")
            .getOrCreate();

        logger.info("Starting OTel archive job, mode={}", mode);

        try {
            switch (mode.toLowerCase()) {
                case "metrics":
                    archiveMetrics(spark);
                    break;
                case "logs":
                    archiveLogs(spark);
                    break;
                case "traces":
                    archiveTraces(spark);
                    break;
                case "all":
                default:
                    archiveMetrics(spark);
                    archiveLogs(spark);
                    archiveTraces(spark);
                    break;
            }
        } finally {
            spark.stop();
        }
    }

    /**
     * Archive metrics from Kafka to Hudi.
     */
    private static void archiveMetrics(SparkSession spark) {
        logger.info("Archiving OTel metrics...");

        StructType schema = new StructType()
            .add("resourceMetrics", ArrayType.apply(new StructType()
                .add("resource", new StructType()
                    .add("attributes", ArrayType.apply(new StructType()
                        .add("key", DataTypes.StringType)
                        .add("value", new StructType()
                            .add("stringValue", DataTypes.StringType)))))
                .add("scopeMetrics", ArrayType.apply(new StructType()
                    .add("metrics", ArrayType.apply(new StructType()
                        .add("name", DataTypes.StringType)
                        .add("gauge", new StructType()
                            .add("dataPoints", ArrayType.apply(new StructType()
                                .add("timeUnixNano", DataTypes.LongType)
                                .add("asDouble", DataTypes.DoubleType)
                                .add("attributes", ArrayType.apply(new StructType()
                                    .add("key", DataTypes.StringType)
                                    .add("value", new StructType()
                                        .add("stringValue", DataTypes.StringType)))))))
                        .add("sum", new StructType()
                            .add("dataPoints", ArrayType.apply(new StructType()
                                .add("timeUnixNano", DataTypes.LongType)
                                .add("asDouble", DataTypes.DoubleType))))))))));

        Dataset<Row> kafkaDF = spark.read()
            .format("kafka")
            .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
            .option("subscribe", "otel-metrics")
            .option("startingOffsets", "earliest")
            .option("endingOffsets", "latest")
            .load();

        Dataset<Row> metricsDF = kafkaDF
            .selectExpr("CAST(value AS STRING) as json_value")
            .select(functions.from_json(functions.col("json_value"), schema).as("data"))
            .select(functions.explode(functions.col("data.resourceMetrics")).as("rm"))
            .select(
                functions.col("rm.resource.attributes").as("resource_attrs"),
                functions.explode(functions.col("rm.scopeMetrics")).as("sm"))
            .select(
                functions.col("resource_attrs"),
                functions.explode(functions.col("sm.metrics")).as("metric"))
            .select(
                extractServiceName(functions.col("resource_attrs")).as("service_name"),
                functions.col("metric.name").as("metric_name"),
                functions.when(functions.col("metric.gauge").isNotNull(), "gauge")
                    .when(functions.col("metric.sum").isNotNull(), "counter")
                    .otherwise("unknown").as("metric_type"),
                functions.coalesce(
                    functions.col("metric.gauge.dataPoints").getItem(0).getField("asDouble"),
                    functions.col("metric.sum.dataPoints").getItem(0).getField("asDouble"),
                    functions.lit(0.0)).as("value"),
                functions.coalesce(
                    functions.col("metric.gauge.dataPoints").getItem(0).getField("timeUnixNano"),
                    functions.col("metric.sum.dataPoints").getItem(0).getField("timeUnixNano"),
                    functions.lit(System.currentTimeMillis() * 1000000L)).as("timestamp"),
                functions.to_json(functions.col("metric.gauge.dataPoints").getItem(0).getField("attributes"))
                    .as("labels"))
            .withColumn("id", functions.concat_ws("-",
                functions.col("service_name"),
                functions.col("metric_name"),
                functions.col("timestamp").cast(DataTypes.StringType)))
            .withColumn("dt", functions.date_format(
                functions.from_unixtime(functions.col("timestamp").divide(1000000000L)), "yyyy-MM-dd"))
            .filter(functions.col("service_name").isNotNull());

        writeToHudi(metricsDF, "otel_metrics", "id", "timestamp", "service_name,dt");
        logger.info("Metrics archive completed");
    }

    /**
     * Archive logs from Kafka to Hudi.
     */
    private static void archiveLogs(SparkSession spark) {
        logger.info("Archiving OTel logs...");

        StructType schema = new StructType()
            .add("resourceLogs", ArrayType.apply(new StructType()
                .add("resource", new StructType()
                    .add("attributes", ArrayType.apply(new StructType()
                        .add("key", DataTypes.StringType)
                        .add("value", new StructType()
                            .add("stringValue", DataTypes.StringType)))))
                .add("scopeLogs", ArrayType.apply(new StructType()
                    .add("logRecords", ArrayType.apply(new StructType()
                        .add("timeUnixNano", DataTypes.LongType)
                        .add("severityText", DataTypes.StringType)
                        .add("body", new StructType()
                            .add("stringValue", DataTypes.StringType))
                        .add("traceId", DataTypes.StringType)
                        .add("spanId", DataTypes.StringType)
                        .add("attributes", ArrayType.apply(new StructType()
                            .add("key", DataTypes.StringType)
                            .add("value", new StructType()
                                .add("stringValue", DataTypes.StringType))))))))));

        Dataset<Row> kafkaDF = spark.read()
            .format("kafka")
            .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
            .option("subscribe", "otel-logs")
            .option("startingOffsets", "earliest")
            .option("endingOffsets", "latest")
            .load();

        Dataset<Row> logsDF = kafkaDF
            .selectExpr("CAST(value AS STRING) as json_value")
            .select(functions.from_json(functions.col("json_value"), schema).as("data"))
            .select(functions.explode(functions.col("data.resourceLogs")).as("rl"))
            .select(
                functions.col("rl.resource.attributes").as("resource_attrs"),
                functions.explode(functions.col("rl.scopeLogs")).as("sl"))
            .select(
                functions.col("resource_attrs"),
                functions.explode(functions.col("sl.logRecords")).as("log"))
            .select(
                extractServiceName(functions.col("resource_attrs")).as("service_name"),
                functions.col("log.traceId").as("trace_id"),
                functions.col("log.spanId").as("span_id"),
                functions.col("log.severityText").as("severity"),
                functions.col("log.body.stringValue").as("body"),
                functions.to_json(functions.col("log.attributes")).as("attributes"),
                functions.to_json(functions.col("resource_attrs")).as("resource_attributes"),
                functions.col("log.timeUnixNano").as("timestamp"))
            .withColumn("id", functions.concat_ws("-",
                functions.col("service_name"),
                functions.coalesce(functions.col("trace_id"), functions.lit("no-trace")),
                functions.col("timestamp").cast(DataTypes.StringType)))
            .withColumn("dt", functions.date_format(
                functions.from_unixtime(functions.col("timestamp").divide(1000000000L)), "yyyy-MM-dd"))
            .filter(functions.col("service_name").isNotNull());

        writeToHudi(logsDF, "otel_logs", "id", "timestamp", "service_name,dt");
        logger.info("Logs archive completed");
    }

    /**
     * Archive traces from Kafka to Hudi.
     */
    private static void archiveTraces(SparkSession spark) {
        logger.info("Archiving OTel traces...");

        StructType schema = new StructType()
            .add("resourceSpans", ArrayType.apply(new StructType()
                .add("resource", new StructType()
                    .add("attributes", ArrayType.apply(new StructType()
                        .add("key", DataTypes.StringType)
                        .add("value", new StructType()
                            .add("stringValue", DataTypes.StringType)))))
                .add("scopeSpans", ArrayType.apply(new StructType()
                    .add("spans", ArrayType.apply(new StructType()
                        .add("traceId", DataTypes.StringType)
                        .add("spanId", DataTypes.StringType)
                        .add("parentSpanId", DataTypes.StringType)
                        .add("name", DataTypes.StringType)
                        .add("startTimeUnixNano", DataTypes.LongType)
                        .add("endTimeUnixNano", DataTypes.LongType)
                        .add("status", new StructType()
                            .add("code", DataTypes.StringType))
                        .add("attributes", ArrayType.apply(new StructType()
                            .add("key", DataTypes.StringType)
                            .add("value", new StructType()
                                .add("stringValue", DataTypes.StringType))))
                        .add("events", ArrayType.apply(new StructType()
                            .add("name", DataTypes.StringType)
                            .add("timeUnixNano", DataTypes.LongType)))))))));

        Dataset<Row> kafkaDF = spark.read()
            .format("kafka")
            .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
            .option("subscribe", "otel-traces")
            .option("startingOffsets", "earliest")
            .option("endingOffsets", "latest")
            .load();

        Dataset<Row> tracesDF = kafkaDF
            .selectExpr("CAST(value AS STRING) as json_value")
            .select(functions.from_json(functions.col("json_value"), schema).as("data"))
            .select(functions.explode(functions.col("data.resourceSpans")).as("rs"))
            .select(
                functions.col("rs.resource.attributes").as("resource_attrs"),
                functions.explode(functions.col("rs.scopeSpans")).as("ss"))
            .select(
                functions.col("resource_attrs"),
                functions.explode(functions.col("ss.spans")).as("span"))
            .select(
                extractServiceName(functions.col("resource_attrs")).as("service_name"),
                functions.col("span.traceId").as("trace_id"),
                functions.col("span.spanId").as("span_id"),
                functions.col("span.parentSpanId").as("parent_span_id"),
                functions.col("span.name").as("operation_name"),
                functions.expr("(span.endTimeUnixNano - span.startTimeUnixNano) / 1000000").as("duration_ms"),
                functions.coalesce(
                    functions.col("span.status.code"),
                    functions.lit("UNSET")).as("status_code"),
                functions.to_json(functions.col("span.attributes")).as("attributes"),
                functions.to_json(functions.col("span.events")).as("events"),
                functions.col("span.startTimeUnixNano").as("timestamp"))
            .withColumn("id", functions.concat_ws("-",
                functions.col("trace_id"),
                functions.col("span_id")))
            .withColumn("dt", functions.date_format(
                functions.from_unixtime(functions.col("timestamp").divide(1000000000L)), "yyyy-MM-dd"))
            .filter(functions.col("service_name").isNotNull());

        writeToHudi(tracesDF, "otel_traces", "id", "timestamp", "service_name,dt");
        logger.info("Traces archive completed");
    }

    /**
     * Extract service name from OTel resource attributes.
     */
    private static Column extractServiceName(Column attrs) {
        return functions.expr(
            "filter(transform(" + attrs + ", x -> " +
            "CASE WHEN x.key = 'service.name' THEN x.value.stringValue ELSE NULL END), " +
            "x -> x IS NOT NULL)[0]");
    }

    /**
     * Write DataFrame to Hudi with upsert semantics.
     */
    private static void writeToHudi(Dataset<Row> df, String tableName, 
            String recordKey, String precombineField, String partitionPath) {
        
        String hudiPath = HUDI_BASE_PATH + "/otel/" + tableName;
        
        Map<String, String> hudiOptions = new HashMap<>();
        hudiOptions.put(HoodieWriteConfig.TBL_NAME.key(), tableName);
        hudiOptions.put(DataSourceWriteOptions.TABLE_TYPE().key(), "MERGE_ON_READ");
        hudiOptions.put(DataSourceWriteOptions.RECORDKEY_FIELD().key(), recordKey);
        hudiOptions.put(DataSourceWriteOptions.PRECOMBINE_FIELD().key(), precombineField);
        hudiOptions.put(DataSourceWriteOptions.PARTITIONPATH_FIELD().key(), partitionPath);
        hudiOptions.put(DataSourceWriteOptions.OPERATION().key(), "upsert");
        hudiOptions.put(DataSourceWriteOptions.HIVE_SYNC_ENABLED().key(), "true");
        hudiOptions.put(DataSourceWriteOptions.HIVE_DATABASE().key(), "otel");
        hudiOptions.put(DataSourceWriteOptions.HIVE_TABLE().key(), tableName);
        hudiOptions.put(DataSourceWriteOptions.HIVE_PARTITION_FIELDS().key(), partitionPath);
        hudiOptions.put("hoodie.datasource.hive_sync.mode", "hms");
        hudiOptions.put("hoodie.datasource.hive_sync.metastore.uris", 
            System.getenv().getOrDefault("HIVE_METASTORE_URI", "thrift://hive-metastore:9083"));

        df.write()
            .format("hudi")
            .options(hudiOptions)
            .mode(SaveMode.Append)
            .save(hudiPath);

        logger.info("Written to Hudi: {}, path={}", tableName, hudiPath);
    }
}
