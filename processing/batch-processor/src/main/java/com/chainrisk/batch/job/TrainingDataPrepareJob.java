package com.chainrisk.batch.job;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Timestamp;
import java.time.Instant;

import static org.apache.spark.sql.functions.*;

/**
 * Training Data Prepare Job
 * 
 * Joins address_features with address_labels to create the training_dataset table.
 * 
 * Label mapping:
 * - sanctioned, mixer -> label = 1 (risky)
 * - exchange -> label = 0 (normal)
 * - no label -> label = NULL (unknown, for unsupervised learning)
 */
public class TrainingDataPrepareJob {
    private static final Logger LOG = LoggerFactory.getLogger(TrainingDataPrepareJob.class);
    
    private static final String DATASET_VERSION = "v1";

    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final String hiveMetastoreUri;
    private final String sparkMaster;
    private final String network;

    public TrainingDataPrepareJob(String hudiBasePath, String minioEndpoint,
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
        LOG.info("Starting TrainingDataPrepareJob for network: {}", network);
        
        SparkSession spark = createSparkSession();
        
        try {
            // Read features
            Dataset<Row> features = readFeatures(spark);
            long featureCount = features.count();
            LOG.info("Read {} features from Hudi", featureCount);
            
            if (featureCount == 0) {
                LOG.warn("No features found, nothing to process");
                return;
            }
            
            // Read labels
            Dataset<Row> labels = readLabels(spark);
            long labelCount = labels.count();
            LOG.info("Read {} labels from Hudi", labelCount);
            
            // Join features with labels
            Dataset<Row> trainingData = joinFeaturesAndLabels(features, labels);
            long trainingCount = trainingData.count();
            LOG.info("Created training dataset with {} records", trainingCount);
            
            // Count label distribution
            trainingData.groupBy("label").count().show();
            
            // Write to Hudi
            writeTrainingData(trainingData);
            
            LOG.info("TrainingDataPrepareJob completed successfully");
            
        } catch (Exception e) {
            LOG.error("TrainingDataPrepareJob failed", e);
            throw new RuntimeException("Training data prepare job failed", e);
        } finally {
            spark.stop();
        }
    }

    private SparkSession createSparkSession() {
        return SparkSession.builder()
                .appName("TrainingDataPrepareJob")
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

    private Dataset<Row> readFeatures(SparkSession spark) {
        String path = hudiBasePath + "/address_features";
        
        Dataset<Row> df = spark.read()
                .format("hudi")
                .load(path);
        
        // Filter by network if specified
        if (network != null && !network.isEmpty() && !network.equals("all")) {
            df = df.filter(col("network").equalTo(network));
        }
        
        return df;
    }

    private Dataset<Row> readLabels(SparkSession spark) {
        String path = hudiBasePath + "/address_labels";
        
        try {
            return spark.read()
                    .format("hudi")
                    .load(path);
        } catch (Exception e) {
            LOG.warn("Could not read labels table, may not exist yet: {}", e.getMessage());
            // Return empty DataFrame with expected schema
            return spark.emptyDataFrame();
        }
    }

    private Dataset<Row> joinFeaturesAndLabels(Dataset<Row> features, Dataset<Row> labels) {
        Timestamp now = Timestamp.from(Instant.now());
        
        // Prepare labels with priority (keep highest priority label per address)
        // Priority: sanctioned > mixer > exchange
        Dataset<Row> labelsPrioritized;
        
        if (labels.count() > 0) {
            labelsPrioritized = labels
                    .withColumn("label_priority", 
                            when(col("label_type").equalTo("sanctioned"), 1)
                            .when(col("label_type").equalTo("mixer"), 2)
                            .when(col("label_type").equalTo("exchange"), 3)
                            .otherwise(4))
                    .orderBy(col("address"), col("label_priority"))
                    .dropDuplicates("address")
                    .select(
                            col("address").alias("label_address"),
                            col("label_type"),
                            col("source").alias("label_source")
                    );
        } else {
            // No labels - create empty DataFrame
            labelsPrioritized = features.sparkSession().emptyDataFrame();
        }
        
        // Join features with labels
        Dataset<Row> joined;
        
        if (labelsPrioritized.count() > 0) {
            joined = features.join(
                    labelsPrioritized,
                    features.col("address").equalTo(labelsPrioritized.col("label_address")),
                    "left_outer"
            );
        } else {
            // No labels to join
            joined = features
                    .withColumn("label_address", lit(null).cast("string"))
                    .withColumn("label_type", lit(null).cast("string"))
                    .withColumn("label_source", lit(null).cast("string"));
        }
        
        // Create label column based on label_type
        Dataset<Row> withLabel = joined
                .withColumn("label",
                        when(col("label_type").isin("sanctioned", "mixer"), lit(1))
                        .when(col("label_type").equalTo("exchange"), lit(0))
                        .otherwise(lit(null).cast("int")))
                .withColumn("created_at", lit(now))
                .withColumn("dataset_version", lit(DATASET_VERSION));
        
        // Select final columns
        return withLabel.select(
                col("address"),
                col("network"),
                col("tx_count"),
                col("sent_count"),
                col("received_count"),
                col("unique_counterparties"),
                col("avg_tx_value"),
                col("max_tx_value"),
                col("tx_value_stddev"),
                col("address_age_days"),
                col("sent_ratio"),
                col("round_amount_ratio"),
                col("small_tx_ratio"),
                col("large_tx_ratio"),
                col("in_degree"),
                col("out_degree"),
                col("in_out_ratio"),
                col("unique_in_neighbors"),
                col("label"),
                col("label_type"),
                col("label_source"),
                col("created_at"),
                col("dataset_version")
        );
    }

    private void writeTrainingData(Dataset<Row> trainingData) {
        trainingData.write()
                .format("hudi")
                .option("hoodie.table.name", "training_dataset")
                .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
                .option("hoodie.datasource.write.operation", "upsert")
                .option("hoodie.datasource.write.recordkey.field", "address,network")
                .option("hoodie.datasource.write.precombine.field", "created_at")
                .option("hoodie.datasource.write.partitionpath.field", "network")
                .option("hoodie.upsert.shuffle.parallelism", "2")
                .option("hoodie.insert.shuffle.parallelism", "2")
                .option("hoodie.datasource.write.hive_style_partitioning", "true")
                .option("hoodie.embed.timeline.server", "false")
                .option("hoodie.filesystem.view.type", "MEMORY")
                // Hive sync
                .option("hoodie.datasource.hive_sync.enable", "true")
                .option("hoodie.datasource.hive_sync.database", "chainrisk")
                .option("hoodie.datasource.hive_sync.table", "training_dataset")
                .option("hoodie.datasource.hive_sync.mode", "hms")
                .option("hoodie.datasource.hive_sync.metastore.uris", hiveMetastoreUri)
                .option("hoodie.datasource.hive_sync.partition_fields", "network")
                .option("hoodie.datasource.hive_sync.partition_extractor_class",
                        "org.apache.hudi.hive.MultiPartKeysValueExtractor")
                .mode(SaveMode.Overwrite)
                .save(hudiBasePath + "/training_dataset");
        
        LOG.info("Successfully wrote training dataset to Hudi");
    }

    public static void main(String[] args) {
        String minioEndpoint = System.getenv().getOrDefault("MINIO_ENDPOINT", "http://localhost:19000");
        String minioAccessKey = System.getenv().getOrDefault("MINIO_ACCESS_KEY", "minioadmin");
        String minioSecretKey = System.getenv().getOrDefault("MINIO_SECRET_KEY", "minioadmin123");
        String hudiBasePath = System.getenv().getOrDefault("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
        String hiveMetastoreUri = System.getenv().getOrDefault("HIVE_METASTORE_URI", "thrift://localhost:19083");
        String sparkMaster = System.getenv().getOrDefault("SPARK_MASTER", "local[*]");
        String network = System.getenv().getOrDefault("NETWORK", "ethereum");

        TrainingDataPrepareJob job = new TrainingDataPrepareJob(
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                hiveMetastoreUri, sparkMaster, network
        );

        job.run();
    }
}
