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

/**
 * Archive cold data from PostgreSQL to Hudi
 * Runs daily at 02:00, archives data older than 7 days
 */
public class ArchiveToHudiJob {
    private static final Logger LOG = LoggerFactory.getLogger(ArchiveToHudiJob.class);

    private final String postgresUrl;
    private final String postgresUser;
    private final String postgresPassword;
    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final int retentionDays;

    public ArchiveToHudiJob(String postgresUrl, String postgresUser, String postgresPassword,
                           String hudiBasePath, String minioEndpoint, 
                           String minioAccessKey, String minioSecretKey,
                           int retentionDays) {
        this.postgresUrl = postgresUrl;
        this.postgresUser = postgresUser;
        this.postgresPassword = postgresPassword;
        this.hudiBasePath = hudiBasePath;
        this.minioEndpoint = minioEndpoint;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
        this.retentionDays = retentionDays;
    }

    public void run() {
        LOG.info("Starting ArchiveToHudiJob, retention days: {}", retentionDays);

        SparkSession spark = createSparkSession();

        try {
            // Calculate cutoff timestamp
            long cutoffTimestamp = LocalDate.now()
                    .minusDays(retentionDays)
                    .atStartOfDay()
                    .toEpochSecond(ZoneOffset.UTC);

            LOG.info("Archiving transfers older than {} (timestamp < {})", 
                    LocalDate.now().minusDays(retentionDays), cutoffTimestamp);

            // 1. Read cold data from PostgreSQL
            Dataset<Row> coldData = readColdData(spark, cutoffTimestamp);
            long count = coldData.count();

            if (count == 0) {
                LOG.info("No cold data to archive");
                return;
            }

            LOG.info("Found {} records to archive", count);

            // 2. Add partition column (dt)
            Dataset<Row> dataWithPartition = coldData
                    .withColumn("dt", functions.to_date(functions.col("timestamp")))
                    .withColumn("source", functions.lit("archive"));

            // 3. Write to Hudi
            writeToHudi(dataWithPartition);
            LOG.info("Successfully wrote {} records to Hudi", count);

            // 4. Delete archived data from PostgreSQL
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
                .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
                .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension")
                .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog")
                // S3/MinIO config
                .config("spark.hadoop.fs.s3a.endpoint", minioEndpoint)
                .config("spark.hadoop.fs.s3a.access.key", minioAccessKey)
                .config("spark.hadoop.fs.s3a.secret.key", minioSecretKey)
                .config("spark.hadoop.fs.s3a.path.style.access", "true")
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
                .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
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
                        "value, token_address, token_symbol, token_decimal, " +
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
                .option("hoodie.datasource.write.table.type", "MERGE_ON_READ")
                .option("hoodie.datasource.write.operation", "upsert")
                .option("hoodie.datasource.write.recordkey.field", "tx_hash,log_index")
                .option("hoodie.datasource.write.precombine.field", "block_number")
                .option("hoodie.datasource.write.partitionpath.field", "network,dt")
                .option("hoodie.upsert.shuffle.parallelism", "100")
                .option("hoodie.insert.shuffle.parallelism", "100")
                .option("hoodie.datasource.write.hive_style_partitioning", "true")
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
        
        int retentionDays = Integer.parseInt(System.getenv().getOrDefault("RETENTION_DAYS", "7"));

        String postgresUrl = String.format("jdbc:postgresql://%s:%s/%s", 
                postgresHost, postgresPort, postgresDb);

        ArchiveToHudiJob job = new ArchiveToHudiJob(
                postgresUrl, postgresUser, postgresPassword,
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                retentionDays
        );

        job.run();
    }
}
