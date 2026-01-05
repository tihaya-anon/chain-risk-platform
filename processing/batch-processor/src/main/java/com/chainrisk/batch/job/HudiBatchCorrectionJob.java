package com.chainrisk.batch.job;

import org.apache.spark.sql.*;
import org.apache.spark.sql.types.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Hudi Batch Correction Job - Lambda Architecture Batch Layer
 * 
 * This job reads historical transfers from Hudi data lake,
 * applies risk scoring corrections based on updated rules/labels,
 * and writes the corrected data back to Hudi.
 * 
 * Use cases:
 * 1. Re-score historical transactions when risk rules are updated
 * 2. Apply new address labels/tags retroactively
 * 3. Fix data quality issues in historical data
 * 4. Recalculate aggregations after algorithm changes
 */
public class HudiBatchCorrectionJob {
    private static final Logger LOG = LoggerFactory.getLogger(HudiBatchCorrectionJob.class);

    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final String hiveMetastoreUri;
    private final String sparkMaster;
    private final String startDate;  // Optional: filter by date range
    private final String endDate;

    public HudiBatchCorrectionJob(String hudiBasePath, String minioEndpoint,
                                   String minioAccessKey, String minioSecretKey,
                                   String hiveMetastoreUri, String sparkMaster,
                                   String startDate, String endDate) {
        this.hudiBasePath = hudiBasePath;
        this.minioEndpoint = minioEndpoint;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
        this.hiveMetastoreUri = hiveMetastoreUri;
        this.sparkMaster = sparkMaster;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public void run() {
        LOG.info("=== Starting Hudi Batch Correction Job ===");
        LOG.info("Hudi Path: {}", hudiBasePath);
        LOG.info("Date Range: {} to {}", startDate != null ? startDate : "beginning", 
                                          endDate != null ? endDate : "now");

        SparkSession spark = createSparkSession();

        try {
            // Step 1: Read historical data from Hudi
            LOG.info("Reading historical transfers from Hudi...");
            Dataset<Row> historicalData = readFromHudi(spark);
            
            long totalRecords = historicalData.count();
            LOG.info("Found {} historical records", totalRecords);

            if (totalRecords == 0) {
                LOG.info("No records to correct, exiting");
                return;
            }

            // Step 2: Apply corrections
            LOG.info("Applying batch corrections...");
            Dataset<Row> correctedData = applyCorrections(historicalData);

            // Step 3: Show sample of corrections
            LOG.info("Sample of corrected data:");
            correctedData.select("tx_hash", "from_address", "to_address", 
                                "risk_score", "risk_category", "correction_timestamp")
                        .show(10, false);

            // Step 4: Write corrected data back to Hudi
            LOG.info("Writing corrected data back to Hudi...");
            writeToHudi(correctedData);

            // Step 5: Generate correction summary
            generateCorrectionSummary(correctedData);

            LOG.info("=== Hudi Batch Correction Job Complete ===");
            LOG.info("Corrected {} records", totalRecords);

        } catch (Exception e) {
            LOG.error("Batch correction job failed", e);
            throw new RuntimeException("Batch correction failed", e);
        } finally {
            spark.stop();
        }
    }

    private SparkSession createSparkSession() {
        return SparkSession.builder()
                .appName("HudiBatchCorrectionJob")
                .master(sparkMaster)
                .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
                .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension")
                .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog")
                .config("spark.hadoop.fs.s3a.endpoint", minioEndpoint)
                .config("spark.hadoop.fs.s3a.access.key", minioAccessKey)
                .config("spark.hadoop.fs.s3a.secret.key", minioSecretKey)
                .config("spark.hadoop.fs.s3a.path.style.access", "true")
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
                .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
                .config("hive.metastore.uris", hiveMetastoreUri)
                .enableHiveSupport()
                .getOrCreate();
    }

    private Dataset<Row> readFromHudi(SparkSession spark) {
        Dataset<Row> df = spark.read()
                .format("hudi")
                .load(hudiBasePath + "/transfers");

        // Apply date filter if specified
        if (startDate != null && endDate != null) {
            df = df.filter(functions.col("dt").between(startDate, endDate));
        } else if (startDate != null) {
            df = df.filter(functions.col("dt").geq(startDate));
        } else if (endDate != null) {
            df = df.filter(functions.col("dt").leq(endDate));
        }

        return df;
    }

    /**
     * Apply corrections to historical data.
     * 
     * This is where the actual correction logic goes:
     * - Risk score recalculation
     * - Address label updates
     * - Data quality fixes
     */
    private Dataset<Row> applyCorrections(Dataset<Row> data) {
        // Add correction metadata
        Dataset<Row> corrected = data
                .withColumn("correction_timestamp", functions.current_timestamp())
                .withColumn("correction_version", functions.lit("v2.0"));

        // Calculate risk score based on transfer patterns
        // This is a simplified example - in production, this would be more sophisticated
        corrected = corrected.withColumn("risk_score", 
            functions.when(
                // High value transfers (> 1M tokens) get higher risk score
                functions.col("value").cast("double").divide(functions.pow(functions.lit(10), 
                    functions.coalesce(functions.col("token_decimal"), functions.lit(18))))
                    .gt(1000000),
                functions.lit(80)
            ).when(
                // Medium value transfers (> 100K tokens)
                functions.col("value").cast("double").divide(functions.pow(functions.lit(10), 
                    functions.coalesce(functions.col("token_decimal"), functions.lit(18))))
                    .gt(100000),
                functions.lit(50)
            ).otherwise(
                // Low value transfers
                functions.lit(20)
            )
        );

        // Categorize risk
        corrected = corrected.withColumn("risk_category",
            functions.when(functions.col("risk_score").geq(70), functions.lit("HIGH"))
                    .when(functions.col("risk_score").geq(40), functions.lit("MEDIUM"))
                    .otherwise(functions.lit("LOW"))
        );

        // Flag known exchange addresses (example - in production, load from reference data)
        corrected = corrected.withColumn("is_exchange",
            functions.when(
                functions.col("to_address").isin(
                    "0xdac17f958d2ee523a2206206994597c13d831ec7",  // Example exchange address
                    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"   // Another example
                ),
                functions.lit(true)
            ).otherwise(functions.lit(false))
        );

        return corrected;
    }

    private void writeToHudi(Dataset<Row> data) {
        // Keep all original columns and add new ones
        // Use coalesce to handle columns that might not exist in source
        Dataset<Row> outputData = data.select(
            functions.col("tx_hash"),
            functions.col("block_number"),
            functions.col("log_index"),
            functions.col("from_address"),
            functions.col("to_address"),
            functions.col("value"),
            functions.col("token_address"),
            functions.col("token_symbol"),
            functions.col("token_decimal"),
            functions.col("timestamp"),
            functions.col("transfer_type"),
            functions.col("network"),
            // Keep created_at from original data if exists, otherwise use current timestamp
            functions.coalesce(functions.col("created_at"), functions.current_timestamp()).alias("created_at"),
            functions.col("dt"),
            functions.col("source"),
            // New correction fields
            functions.col("risk_score"),
            functions.col("risk_category"),
            functions.col("is_exchange"),
            functions.col("correction_timestamp"),
            functions.col("correction_version")
        );

        outputData.write()
                .format("hudi")
                .option("hoodie.table.name", "transfers")
                .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
                .option("hoodie.datasource.write.operation", "upsert")
                .option("hoodie.datasource.write.recordkey.field", "tx_hash,log_index")
                .option("hoodie.datasource.write.precombine.field", "block_number")
                .option("hoodie.datasource.write.partitionpath.field", "network,dt")
                .option("hoodie.upsert.shuffle.parallelism", "2")
                .option("hoodie.insert.shuffle.parallelism", "2")
                .option("hoodie.datasource.write.hive_style_partitioning", "true")
                .option("hoodie.embed.timeline.server", "false")
                .option("hoodie.filesystem.view.type", "MEMORY")
                // Enable schema evolution to allow adding new columns
                .option("hoodie.schema.on.read.enable", "true")
                .option("hoodie.datasource.write.reconcile.schema", "true")
                // Hive sync options
                .option("hoodie.datasource.hive_sync.enable", "true")
                .option("hoodie.datasource.hive_sync.database", "chainrisk")
                .option("hoodie.datasource.hive_sync.table", "transfers")
                .option("hoodie.datasource.hive_sync.mode", "hms")
                .option("hoodie.datasource.hive_sync.metastore.uris", hiveMetastoreUri)
                .option("hoodie.datasource.hive_sync.partition_fields", "network,dt")
                .option("hoodie.datasource.hive_sync.partition_extractor_class",
                        "org.apache.hudi.hive.MultiPartKeysValueExtractor")
                .mode(SaveMode.Append)
                .save(hudiBasePath + "/transfers");

        LOG.info("Successfully wrote corrected data to Hudi");
    }

    private void generateCorrectionSummary(Dataset<Row> data) {
        LOG.info("=== Correction Summary ===");

        // Risk distribution
        LOG.info("Risk Distribution:");
        data.groupBy("risk_category")
            .count()
            .orderBy(functions.desc("count"))
            .show();

        // By network and date
        LOG.info("Records by Network and Date:");
        data.groupBy("network", "dt")
            .agg(
                functions.count("*").alias("record_count"),
                functions.avg("risk_score").alias("avg_risk_score")
            )
            .orderBy("network", "dt")
            .show(20);

        // High risk transfers
        long highRiskCount = data.filter(functions.col("risk_category").equalTo("HIGH")).count();
        LOG.info("High Risk Transfers: {}", highRiskCount);
    }

    public static void main(String[] args) {
        String minioEndpoint = System.getenv().getOrDefault("MINIO_ENDPOINT", "http://localhost:19000");
        String minioAccessKey = System.getenv().getOrDefault("MINIO_ACCESS_KEY", "minioadmin");
        String minioSecretKey = System.getenv().getOrDefault("MINIO_SECRET_KEY", "minioadmin123");
        String hudiBasePath = System.getenv().getOrDefault("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
        String hiveMetastoreUri = System.getenv().getOrDefault("HIVE_METASTORE_URI", "thrift://localhost:19083");
        String sparkMaster = System.getenv().getOrDefault("SPARK_MASTER", "local[*]");
        
        // Optional date range filters
        String startDate = System.getenv().get("START_DATE");  // Format: yyyy-MM-dd
        String endDate = System.getenv().get("END_DATE");

        HudiBatchCorrectionJob job = new HudiBatchCorrectionJob(
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                hiveMetastoreUri, sparkMaster, startDate, endDate
        );

        job.run();
    }
}
