package com.chainrisk.batch.job;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.DataTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Timestamp;
import java.time.Instant;

import static org.apache.spark.sql.functions.*;

/**
 * Feature Compute Job
 * 
 * Computes ML features from transfers table and writes to address_features table.
 * 
 * Features computed (V1 - 16 features):
 * - Transaction stats: tx_count, sent_count, received_count, unique_counterparties
 * - Value stats: avg_tx_value, max_tx_value, tx_value_stddev
 * - Time: address_age_days
 * - Ratios: sent_ratio, round_amount_ratio, small_tx_ratio, large_tx_ratio
 * - Graph: in_degree, out_degree, in_out_ratio, unique_in_neighbors
 */
public class FeatureComputeJob {
    private static final Logger LOG = LoggerFactory.getLogger(FeatureComputeJob.class);
    
    private static final String FEATURE_VERSION = "v1";
    private static final double WEI_TO_ETH = 1e18;
    private static final double SMALL_TX_THRESHOLD = 0.01;  // ETH
    private static final double LARGE_TX_THRESHOLD = 10.0;  // ETH

    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final String hiveMetastoreUri;
    private final String sparkMaster;
    private final String network;

    public FeatureComputeJob(String hudiBasePath, String minioEndpoint,
                            String minioAccessKey, String minioSecretKey,
                            String hiveMetastoreUri, String sparkMaster,
                            String network) {
        this.hudiBasePath = hudiBasePath;
        this.minioEndpoint = minioEndpoint;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
        this.hiveMetastoreUri = hiveMetastoreUri;
        this.sparkMaster = sparkMaster;
        this.network = network;
    }

    public void run() {
        LOG.info("Starting FeatureComputeJob for network: {}", network);
        
        SparkSession spark = createSparkSession();
        
        try {
            // Read transfers from Hudi
            Dataset<Row> transfers = readTransfers(spark);
            long transferCount = transfers.count();
            LOG.info("Read {} transfers from Hudi", transferCount);
            
            if (transferCount == 0) {
                LOG.info("No transfers to process");
                return;
            }
            
            // Compute features
            Dataset<Row> features = computeFeatures(transfers);
            long featureCount = features.count();
            LOG.info("Computed features for {} addresses", featureCount);
            
            // Write to Hudi
            writeFeatures(features);
            LOG.info("Successfully wrote features to Hudi");
            
            LOG.info("FeatureComputeJob completed successfully");
            
        } catch (Exception e) {
            LOG.error("FeatureComputeJob failed", e);
            throw new RuntimeException("Feature compute job failed", e);
        } finally {
            spark.stop();
        }
    }

    private SparkSession createSparkSession() {
        return SparkSession.builder()
                .appName("FeatureComputeJob")
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

    private Dataset<Row> readTransfers(SparkSession spark) {
        String path = hudiBasePath + "/transfers";
        
        Dataset<Row> df = spark.read()
                .format("hudi")
                .load(path);
        
        // Filter by network if specified
        if (network != null && !network.isEmpty() && !network.equals("all")) {
            df = df.filter(col("network").equalTo(network));
        }
        
        return df;
    }

    private Dataset<Row> computeFeatures(Dataset<Row> transfers) {
        // Convert value to ETH
        Dataset<Row> withEth = transfers
                .withColumn("value_eth", 
                    col("value").cast(DataTypes.DoubleType).divide(lit(WEI_TO_ETH)));
        
        // Compute sent stats (address as sender)
        Dataset<Row> sentStats = withEth
                .groupBy(col("from_address").alias("address"))
                .agg(
                    count("*").alias("sent_count"),
                    countDistinct("to_address").alias("unique_out_neighbors"),
                    sum("value_eth").alias("total_sent"),
                    max("timestamp").alias("last_sent"),
                    min("timestamp").alias("first_sent")
                );
        
        // Compute received stats (address as receiver)
        Dataset<Row> receivedStats = withEth
                .groupBy(col("to_address").alias("address"))
                .agg(
                    count("*").alias("received_count"),
                    countDistinct("from_address").alias("unique_in_neighbors"),
                    sum("value_eth").alias("total_received"),
                    max("timestamp").alias("last_received"),
                    min("timestamp").alias("first_received")
                );
        
        // Compute value stats for all transactions
        Dataset<Row> valueStats = computeValueStats(withEth);
        
        // Join all stats
        Dataset<Row> features = sentStats
                .join(receivedStats, 
                      sentStats.col("address").equalTo(receivedStats.col("address")), 
                      "full_outer")
                .select(
                    coalesce(sentStats.col("address"), receivedStats.col("address")).alias("address"),
                    coalesce(sentStats.col("sent_count"), lit(0L)).alias("sent_count"),
                    coalesce(receivedStats.col("received_count"), lit(0L)).alias("received_count"),
                    coalesce(sentStats.col("unique_out_neighbors"), lit(0L)).alias("unique_out_neighbors"),
                    coalesce(receivedStats.col("unique_in_neighbors"), lit(0L)).alias("unique_in_neighbors"),
                    coalesce(sentStats.col("first_sent"), receivedStats.col("first_received")).alias("first_seen"),
                    greatest(sentStats.col("last_sent"), receivedStats.col("last_received")).alias("last_seen")
                );
        
        // Add value stats
        features = features.join(valueStats, "address", "left_outer");
        
        // Compute derived features
        Timestamp now = Timestamp.from(Instant.now());
        
        features = features
                .withColumn("tx_count", col("sent_count").plus(col("received_count")))
                .withColumn("unique_counterparties", 
                    col("unique_out_neighbors").plus(col("unique_in_neighbors")))
                .withColumn("address_age_days",
                    when(col("first_seen").isNotNull().and(col("last_seen").isNotNull()),
                        floor((col("last_seen").minus(col("first_seen"))).divide(86400)))
                    .otherwise(0).cast(DataTypes.IntegerType))
                .withColumn("sent_ratio",
                    when(col("tx_count").gt(0),
                        col("sent_count").cast(DataTypes.DoubleType).divide(col("tx_count")))
                    .otherwise(0.0))
                .withColumn("in_degree", col("received_count"))
                .withColumn("out_degree", col("sent_count"))
                .withColumn("in_out_ratio",
                    when(col("out_degree").gt(0),
                        col("in_degree").cast(DataTypes.DoubleType).divide(col("out_degree")))
                    .otherwise(-1.0))
                .withColumn("network", lit(network.equals("all") ? "ethereum" : network))
                .withColumn("computed_at", lit(now))
                .withColumn("feature_version", lit(FEATURE_VERSION));
        
        // Select final columns
        return features.select(
                col("address"),
                col("network"),
                col("tx_count"),
                col("sent_count"),
                col("received_count"),
                col("unique_counterparties"),
                coalesce(col("avg_tx_value"), lit(0.0)).alias("avg_tx_value"),
                coalesce(col("max_tx_value"), lit(0.0)).alias("max_tx_value"),
                coalesce(col("tx_value_stddev"), lit(0.0)).alias("tx_value_stddev"),
                col("address_age_days"),
                col("sent_ratio"),
                coalesce(col("round_amount_ratio"), lit(0.0)).alias("round_amount_ratio"),
                coalesce(col("small_tx_ratio"), lit(0.0)).alias("small_tx_ratio"),
                coalesce(col("large_tx_ratio"), lit(0.0)).alias("large_tx_ratio"),
                col("in_degree"),
                col("out_degree"),
                col("in_out_ratio"),
                col("unique_in_neighbors"),
                col("computed_at"),
                col("feature_version")
        );
    }

    private Dataset<Row> computeValueStats(Dataset<Row> transfers) {
        // Union sent and received with address column
        Dataset<Row> allTx = transfers
                .select(
                    col("from_address").alias("address"),
                    col("value_eth")
                )
                .union(
                    transfers.select(
                        col("to_address").alias("address"),
                        col("value_eth")
                    )
                );
        
        // Compute stats per address
        return allTx.groupBy("address")
                .agg(
                    avg("value_eth").alias("avg_tx_value"),
                    max("value_eth").alias("max_tx_value"),
                    stddev("value_eth").alias("tx_value_stddev"),
                    // Round amount ratio: value is whole number
                    avg(when(col("value_eth").equalTo(floor(col("value_eth"))), 1.0)
                        .otherwise(0.0)).alias("round_amount_ratio"),
                    // Small tx ratio
                    avg(when(col("value_eth").lt(SMALL_TX_THRESHOLD), 1.0)
                        .otherwise(0.0)).alias("small_tx_ratio"),
                    // Large tx ratio
                    avg(when(col("value_eth").gt(LARGE_TX_THRESHOLD), 1.0)
                        .otherwise(0.0)).alias("large_tx_ratio")
                );
    }

    private void writeFeatures(Dataset<Row> features) {
        features.write()
                .format("hudi")
                .option("hoodie.table.name", "address_features")
                .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
                .option("hoodie.datasource.write.operation", "upsert")
                .option("hoodie.datasource.write.recordkey.field", "address,network")
                .option("hoodie.datasource.write.precombine.field", "computed_at")
                .option("hoodie.datasource.write.partitionpath.field", "network")
                .option("hoodie.upsert.shuffle.parallelism", "2")
                .option("hoodie.insert.shuffle.parallelism", "2")
                .option("hoodie.datasource.write.hive_style_partitioning", "true")
                .option("hoodie.embed.timeline.server", "false")
                .option("hoodie.filesystem.view.type", "MEMORY")
                // Hive sync
                .option("hoodie.datasource.hive_sync.enable", "true")
                .option("hoodie.datasource.hive_sync.database", "chainrisk")
                .option("hoodie.datasource.hive_sync.table", "address_features")
                .option("hoodie.datasource.hive_sync.mode", "hms")
                .option("hoodie.datasource.hive_sync.metastore.uris", hiveMetastoreUri)
                .option("hoodie.datasource.hive_sync.partition_fields", "network")
                .option("hoodie.datasource.hive_sync.partition_extractor_class",
                        "org.apache.hudi.hive.MultiPartKeysValueExtractor")
                .mode(SaveMode.Append)
                .save(hudiBasePath + "/address_features");
    }

    public static void main(String[] args) {
        String minioEndpoint = System.getenv().getOrDefault("MINIO_ENDPOINT", "http://localhost:19000");
        String minioAccessKey = System.getenv().getOrDefault("MINIO_ACCESS_KEY", "minioadmin");
        String minioSecretKey = System.getenv().getOrDefault("MINIO_SECRET_KEY", "minioadmin123");
        String hudiBasePath = System.getenv().getOrDefault("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
        String hiveMetastoreUri = System.getenv().getOrDefault("HIVE_METASTORE_URI", "thrift://localhost:19083");
        String sparkMaster = System.getenv().getOrDefault("SPARK_MASTER", "local[*]");
        String network = System.getenv().getOrDefault("NETWORK", "ethereum");

        FeatureComputeJob job = new FeatureComputeJob(
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                hiveMetastoreUri, sparkMaster, network
        );

        job.run();
    }
}
