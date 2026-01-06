package com.chainrisk.batch.job;

import com.chainrisk.batch.job.fetcher.ExchangeFetcher;
import com.chainrisk.batch.job.fetcher.LabelFetcher;
import com.chainrisk.batch.job.fetcher.LabelFetcher.LabelRecord;
import com.chainrisk.batch.job.fetcher.MockLabelFetcher;
import com.chainrisk.batch.job.fetcher.OFACFetcher;
import com.chainrisk.batch.job.fetcher.TornadoCashFetcher;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.RowFactory;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructField;
import org.apache.spark.sql.types.StructType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Label Ingestion Job
 * 
 * Fetches label data from public sources and writes to Hudi address_labels table.
 * 
 * Sources:
 * - OFAC SDN List (sanctioned addresses)
 * - Tornado Cash (mixer addresses)
 * - Known Exchanges (legitimate addresses for negative samples)
 * - Mock (for testing - generates labels for existing addresses)
 */
public class LabelIngestionJob {
    private static final Logger LOG = LoggerFactory.getLogger(LabelIngestionJob.class);

    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final String hiveMetastoreUri;
    private final String sparkMaster;
    private final List<String> enabledSources;

    private static final Map<String, LabelFetcher> FETCHERS = new HashMap<>();
    static {
        FETCHERS.put("ofac", new OFACFetcher());
        FETCHERS.put("tornado_cash", new TornadoCashFetcher());
        FETCHERS.put("exchange", new ExchangeFetcher());
        // Note: mock fetcher is handled separately as it needs address list
    }

    public LabelIngestionJob(String hudiBasePath, String minioEndpoint,
                            String minioAccessKey, String minioSecretKey,
                            String hiveMetastoreUri, String sparkMaster,
                            List<String> enabledSources) {
        this.hudiBasePath = hudiBasePath;
        this.minioEndpoint = minioEndpoint;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
        this.hiveMetastoreUri = hiveMetastoreUri;
        this.sparkMaster = sparkMaster;
        this.enabledSources = enabledSources;
    }

    public void run() {
        LOG.info("Starting LabelIngestionJob with sources: {}", enabledSources);
        
        SparkSession spark = createSparkSession();
        
        try {
            // Fetch labels from all enabled sources
            List<LabelRecord> allLabels = new ArrayList<>();
            Timestamp fetchedAt = Timestamp.from(Instant.now());
            
            for (String source : enabledSources) {
                try {
                    List<LabelRecord> records;
                    
                    if ("mock".equals(source)) {
                        // Mock source: read addresses from address_features and generate labels
                        records = fetchMockLabels(spark);
                    } else {
                        LabelFetcher fetcher = FETCHERS.get(source);
                        if (fetcher == null) {
                            LOG.warn("Unknown source: {}, skipping", source);
                            continue;
                        }
                        LOG.info("Fetching from source: {}", source);
                        records = fetcher.fetch();
                    }
                    
                    allLabels.addAll(records);
                    LOG.info("Fetched {} records from {}", records.size(), source);
                } catch (Exception e) {
                    LOG.error("Failed to fetch from source: {}", source, e);
                }
            }
            
            if (allLabels.isEmpty()) {
                LOG.warn("No labels fetched from any source");
                return;
            }
            
            LOG.info("Total labels fetched: {}", allLabels.size());
            
            // Convert to DataFrame
            Dataset<Row> labelsDf = createDataFrame(spark, allLabels, fetchedAt);
            
            // Write to Hudi
            writeToHudi(labelsDf);
            
            LOG.info("LabelIngestionJob completed successfully");
            
        } catch (Exception e) {
            LOG.error("LabelIngestionJob failed", e);
            throw new RuntimeException("Label ingestion job failed", e);
        } finally {
            spark.stop();
        }
    }
    
    /**
     * Fetch mock labels by reading addresses from address_features table
     */
    private List<LabelRecord> fetchMockLabels(SparkSession spark) {
        LOG.info("Fetching mock labels from address_features");
        
        try {
            // Read existing addresses from address_features
            Dataset<Row> features = spark.read()
                    .format("hudi")
                    .load(hudiBasePath + "/address_features");
            
            List<String> addresses = features.select("address")
                    .distinct()
                    .collectAsList()
                    .stream()
                    .map(row -> row.getString(0))
                    .collect(Collectors.toList());
            
            LOG.info("Found {} unique addresses in address_features", addresses.size());
            
            // Generate mock labels
            MockLabelFetcher mockFetcher = new MockLabelFetcher(addresses);
            return mockFetcher.fetch();
            
        } catch (Exception e) {
            LOG.warn("Failed to read address_features for mock labels: {}", e.getMessage());
            LOG.warn("Make sure to run 'features' job before 'labels' with mock source");
            return new ArrayList<>();
        }
    }

    private SparkSession createSparkSession() {
        return SparkSession.builder()
                .appName("LabelIngestionJob")
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

    private Dataset<Row> createDataFrame(SparkSession spark, List<LabelRecord> labels, 
                                         Timestamp fetchedAt) {
        // Define schema
        StructType schema = DataTypes.createStructType(new StructField[]{
                DataTypes.createStructField("address", DataTypes.StringType, false),
                DataTypes.createStructField("label_type", DataTypes.StringType, false),
                DataTypes.createStructField("label", DataTypes.StringType, true),
                DataTypes.createStructField("source", DataTypes.StringType, false),
                DataTypes.createStructField("confidence", DataTypes.DoubleType, false),
                DataTypes.createStructField("fetched_at", DataTypes.TimestampType, false)
        });
        
        // Convert to rows
        List<Row> rows = labels.stream()
                .map(r -> RowFactory.create(
                        r.getAddress(),
                        r.getLabelType(),
                        r.getLabel(),
                        r.getSource(),
                        r.getConfidence(),
                        fetchedAt
                ))
                .collect(Collectors.toList());
        
        return spark.createDataFrame(rows, schema);
    }

    private void writeToHudi(Dataset<Row> labels) {
        labels.write()
                .format("hudi")
                .option("hoodie.table.name", "address_labels")
                .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
                .option("hoodie.datasource.write.operation", "upsert")
                .option("hoodie.datasource.write.recordkey.field", "address,source")
                .option("hoodie.datasource.write.precombine.field", "fetched_at")
                .option("hoodie.datasource.write.partitionpath.field", "source")
                .option("hoodie.upsert.shuffle.parallelism", "2")
                .option("hoodie.insert.shuffle.parallelism", "2")
                .option("hoodie.datasource.write.hive_style_partitioning", "true")
                .option("hoodie.embed.timeline.server", "false")
                .option("hoodie.filesystem.view.type", "MEMORY")
                // Hive sync
                .option("hoodie.datasource.hive_sync.enable", "true")
                .option("hoodie.datasource.hive_sync.database", "chainrisk")
                .option("hoodie.datasource.hive_sync.table", "address_labels")
                .option("hoodie.datasource.hive_sync.mode", "hms")
                .option("hoodie.datasource.hive_sync.metastore.uris", hiveMetastoreUri)
                .option("hoodie.datasource.hive_sync.partition_fields", "source")
                .option("hoodie.datasource.hive_sync.partition_extractor_class",
                        "org.apache.hudi.hive.MultiPartKeysValueExtractor")
                .mode(SaveMode.Append)
                .save(hudiBasePath + "/address_labels");
        
        LOG.info("Successfully wrote labels to Hudi");
    }

    public static void main(String[] args) {
        String minioEndpoint = System.getenv().getOrDefault("MINIO_ENDPOINT", "http://localhost:19000");
        String minioAccessKey = System.getenv().getOrDefault("MINIO_ACCESS_KEY", "minioadmin");
        String minioSecretKey = System.getenv().getOrDefault("MINIO_SECRET_KEY", "minioadmin123");
        String hudiBasePath = System.getenv().getOrDefault("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
        String hiveMetastoreUri = System.getenv().getOrDefault("HIVE_METASTORE_URI", "thrift://localhost:19083");
        String sparkMaster = System.getenv().getOrDefault("SPARK_MASTER", "local[*]");
        
        // Parse enabled sources (comma-separated)
        // Use "mock" for testing with synthetic labels that match test addresses
        String sourcesEnv = System.getenv().getOrDefault("LABEL_SOURCES", "ofac,tornado_cash,exchange");
        List<String> enabledSources = Arrays.asList(sourcesEnv.split(","))
                .stream()
                .map(String::trim)
                .collect(Collectors.toList());

        LabelIngestionJob job = new LabelIngestionJob(
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                hiveMetastoreUri, sparkMaster, enabledSources
        );

        job.run();
    }
}
