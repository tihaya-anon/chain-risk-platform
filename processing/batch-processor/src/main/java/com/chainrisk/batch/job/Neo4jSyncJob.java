package com.chainrisk.batch.job;

import com.chainrisk.batch.sink.Neo4jBatchWriter;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Neo4j Sync Job
 * 
 * Syncs transfer data from Hudi to Neo4j for graph analysis.
 * Part of Lambda Architecture Batch Layer.
 */
public class Neo4jSyncJob {
    private static final Logger LOG = LoggerFactory.getLogger(Neo4jSyncJob.class);

    private final String hudiBasePath;
    private final String minioEndpoint;
    private final String minioAccessKey;
    private final String minioSecretKey;
    private final String sparkMaster;
    private final String neo4jUri;
    private final String neo4jUser;
    private final String neo4jPassword;
    private final String network;

    public Neo4jSyncJob(String hudiBasePath, String minioEndpoint,
                        String minioAccessKey, String minioSecretKey,
                        String sparkMaster, String neo4jUri,
                        String neo4jUser, String neo4jPassword,
                        String network) {
        this.hudiBasePath = hudiBasePath;
        this.minioEndpoint = minioEndpoint;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
        this.sparkMaster = sparkMaster;
        this.neo4jUri = neo4jUri;
        this.neo4jUser = neo4jUser;
        this.neo4jPassword = neo4jPassword;
        this.network = network;
    }

    public void run() {
        LOG.info("Starting Neo4jSyncJob for network: {}", network);
        
        SparkSession spark = createSparkSession();
        
        try {
            Dataset<Row> transfers = readTransfers(spark);
            long totalCount = transfers.count();
            LOG.info("Found {} transfers to sync", totalCount);
            
            if (totalCount == 0) {
                LOG.info("No transfers to sync");
                return;
            }
            
            syncToNeo4j(transfers);
            LOG.info("Neo4jSyncJob completed successfully");
            
        } catch (Exception e) {
            LOG.error("Neo4jSyncJob failed", e);
            throw new RuntimeException("Neo4j sync failed", e);
        } finally {
            spark.stop();
        }
    }

    private SparkSession createSparkSession() {
        return SparkSession.builder()
                .appName("Neo4jSyncJob")
                .master(sparkMaster)
                .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
                .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension")
                .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog")
                .config("spark.hadoop.fs.s3a.endpoint", minioEndpoint)
                .config("spark.hadoop.fs.s3a.access.key", minioAccessKey)
                .config("spark.hadoop.fs.s3a.secret.key", minioSecretKey)
                .config("spark.hadoop.fs.s3a.path.style.access", "true")
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
                .config("spark.hadoop.fs.s3a.aws.credentials.provider", 
                        "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider")
                .getOrCreate();
    }

    private Dataset<Row> readTransfers(SparkSession spark) {
        String transfersPath = hudiBasePath + "/transfers";
        LOG.info("Reading transfers from: {}", transfersPath);
        
        Dataset<Row> transfers = spark.read()
                .format("hudi")
                .load(transfersPath);
        
        // Filter by network and select columns
        return transfers
                .filter(transfers.col("network").equalTo(network))
                .select(
                        transfers.col("tx_hash"),
                        transfers.col("log_index"),
                        transfers.col("block_number"),
                        transfers.col("from_address"),
                        transfers.col("to_address"),
                        transfers.col("value"),
                        transfers.col("timestamp"),
                        transfers.col("token_address"),
                        transfers.col("token_symbol"),
                        transfers.col("transfer_type"),
                        transfers.col("network"),
                        transfers.col("risk_score"),
                        transfers.col("risk_category"),
                        transfers.col("is_exchange")
                );
    }

    private void syncToNeo4j(Dataset<Row> transfers) {
        long count = transfers.count();
        LOG.info("Syncing {} transfers to Neo4j at {}", count, neo4jUri);
        
        // Repartition for parallel writes (1 partition per 1000 records, max 10)
        int numPartitions = Math.max(1, Math.min(10, (int) (count / 1000)));
        Dataset<Row> repartitioned = transfers.repartition(numPartitions);
        
        repartitioned.foreachPartition(
                new Neo4jBatchWriter(neo4jUri, neo4jUser, neo4jPassword)
        );
        
        LOG.info("Neo4j sync completed");
    }

    public static void main(String[] args) {
        String hudiBasePath = System.getenv().getOrDefault("HUDI_BASE_PATH", "s3a://chainrisk-datalake/hudi");
        String minioEndpoint = System.getenv().getOrDefault("MINIO_ENDPOINT", "http://localhost:19000");
        String minioAccessKey = System.getenv().getOrDefault("MINIO_ACCESS_KEY", "minioadmin");
        String minioSecretKey = System.getenv().getOrDefault("MINIO_SECRET_KEY", "minioadmin123");
        String sparkMaster = System.getenv().getOrDefault("SPARK_MASTER", "local[*]");
        String neo4jUri = System.getenv().getOrDefault("NEO4J_URI", "bolt://localhost:17687");
        String neo4jUser = System.getenv().getOrDefault("NEO4J_USER", "neo4j");
        String neo4jPassword = System.getenv().getOrDefault("NEO4J_PASSWORD", "chainrisk123");
        String network = System.getenv().getOrDefault("NETWORK", "ethereum");

        LOG.info("=== Neo4j Sync Job ===");
        LOG.info("Hudi: {}", hudiBasePath);
        LOG.info("Neo4j: {}", neo4jUri);
        LOG.info("Network: {}", network);

        Neo4jSyncJob job = new Neo4jSyncJob(
                hudiBasePath, minioEndpoint, minioAccessKey, minioSecretKey,
                sparkMaster, neo4jUri, neo4jUser, neo4jPassword, network
        );
        
        job.run();
    }
}
