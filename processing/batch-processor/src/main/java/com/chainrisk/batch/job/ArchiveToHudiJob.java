package com.chainrisk.batch.job;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.functions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneOffset;

public class ArchiveToHudiJob {
    private static final Logger LOG = LoggerFactory.getLogger(ArchiveToHudiJob.class);

    private final String postgresUrl;
    private final String postgresUser;
    private final String postgresPassword;
    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final String hiveMetastoreUri;
    private final int retentionDays;
    private final String sparkMaster;

    public ArchiveToHudiJob(String postgresUrl, String postgresUser, String postgresPassword,
                           String hudiBasePath, String minioEndpoint, 
                           String minioAccessKey, String minioSecretKey,
                           String hiveMetastoreUri,
                           int retentionDays, String sparkMaster) {
        this.postgresUrl = postgresUrl;
        this.postgresUser = postgresUser;
        this.postgresPassword = postgresPassword;
        this.hudiBasePath = hudiBasePath;
        this.minioEndpoint = minioEndpoint;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
        this.hiveMetastoreUri = hiveMetastoreUri;
        this.retentionDays = retentionDays;
        this.sparkMaster = sparkMaster;
    }

    public void run() {
        LOG.info("Starting ArchiveToHudiJob, retention days: {}", retentionDays);

        SparkSession spark = createSparkSession();

        try {
            long cutoffTimestamp = LocalDate.now()
                    .minusDays(retentionDays)
                    .atStartOfDay()
                    .toEpochSecond(ZoneOffset.UTC);

            LOG.info("Archiving transfers older than {} (timestamp < {})", 
                    LocalDate.now().minusDays(retentionDays), cutoffTimestamp);

            Dataset<Row> coldData = readColdData(spark, cutoffTimestamp);
            long count = coldData.count();

            if (count == 0) {
                LOG.info("No cold data to archive");
                return;
            }

            LOG.info("Found {} records to archive", count);

            Dataset<Row> dataWithPartition = coldData
                    .withColumn("dt", functions.to_date(functions.from_unixtime(functions.col("timestamp"))))
                    .withColumn("source", functions.lit("archive"));

            writeToHudi(dataWithPartition);
            LOG.info("Successfully wrote {} records to Hudi", count);

            deleteArchivedData(cutoffTimestamp);
            LOG.info("Deleted archived data from PostgreSQL");

            LOG.info("ArchiveToHudiJob completed successfully");

        } catch (Exception e) {
            LOG.error("ArchiveToHudiJob failed", e);
            throw new RuntimeException("Archive job failed", e);
        } finally {
            spark.stop();
        }
    }

    private SparkSession createSparkSession() {
        return SparkSession.builder()
                .appName("ArchiveToHudiJob")
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

    private Dataset<Row> readColdData(SparkSession spark, long cutoffTimestamp) {
        return spark.read()
                .format("jdbc")
                .option("url", postgresUrl)
                .option("user", postgresUser)
                .option("password", postgresPassword)
                .option("query", String.format(
                        "SELECT tx_hash, block_number, log_index, from_address, to_address, " +
                        "value::text as value, token_address, token_symbol, token_decimal, " +
                        "EXTRACT(EPOCH FROM timestamp)::bigint as timestamp, " +
                        "transfer_type, network, created_at " +
                        "FROM chain_data.transfers " +
                        "WHERE EXTRACT(EPOCH FROM timestamp) < %d", cutoffTimestamp))
                .load();
    }

    private void writeToHudi(Dataset<Row> data) {
        data.write()
                .format("hudi")
                .option("hoodie.table.name", "transfers")
                .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
                .option("hoodie.datasource.write.operation", "insert")
                .option("hoodie.datasource.write.recordkey.field", "tx_hash,log_index")
                .option("hoodie.datasource.write.precombine.field", "block_number")
                .option("hoodie.datasource.write.partitionpath.field", "network,dt")
                .option("hoodie.upsert.shuffle.parallelism", "2")
                .option("hoodie.insert.shuffle.parallelism", "2")
                .option("hoodie.datasource.write.hive_style_partitioning", "true")
                .option("hoodie.embed.timeline.server", "false")
                .option("hoodie.filesystem.view.type", "MEMORY")
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
    }

    private void deleteArchivedData(long cutoffTimestamp) throws Exception {
        try (Connection conn = DriverManager.getConnection(postgresUrl, postgresUser, postgresPassword);
             Statement stmt = conn.createStatement()) {
            
            int deleted = stmt.executeUpdate(String.format(
                    "DELETE FROM chain_data.transfers " +
                    "WHERE EXTRACT(EPOCH FROM timestamp) < %d", cutoffTimestamp));
            
            LOG.info("Deleted {} records from PostgreSQL", deleted);
        }
    }

    public static void main(String[] args) {
        String postgresHost = System.getenv().getOrDefault("POSTGRES_HOST", "localhost");
        String postgresPort = System.getenv().getOrDefault("POSTGRES_PORT", "15432");
        String postgresDb = System.getenv().getOrDefault("POSTGRES_DB", "chainrisk");
        String postgresUser = System.getenv().getOrDefault("POSTGRES_USER", "chainrisk");
        String postgresPassword = System.getenv().getOrDefault("POSTGRES_PASSWORD", "chainrisk123");
        
        String minioEndpoint = System.getenv().getOrDefault("MINIO_ENDPOINT", "http://localhost:19000");
        String minioAccessKey = System.getenv().getOrDefault("MINIO_ACCESS_KEY", "minioadmin");
        String minioSecretKey = System.getenv().getOrDefault("MINIO_SECRET_KEY", "minioadmin123");
        String hudiBasePath = System.getenv().getOrDefault("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
        String hiveMetastoreUri = System.getenv().getOrDefault("HIVE_METASTORE_URI", "thrift://localhost:19083");
        String sparkMaster = System.getenv().getOrDefault("SPARK_MASTER", "local[*]");
        
        int retentionDays = Integer.parseInt(System.getenv().getOrDefault("RETENTION_DAYS", "7"));

        String postgresUrl = String.format("jdbc:postgresql://%s:%s/%s", 
                postgresHost, postgresPort, postgresDb);

        ArchiveToHudiJob job = new ArchiveToHudiJob(
                postgresUrl, postgresUser, postgresPassword,
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                hiveMetastoreUri,
                retentionDays, sparkMaster
        );

        job.run();
    }
}
