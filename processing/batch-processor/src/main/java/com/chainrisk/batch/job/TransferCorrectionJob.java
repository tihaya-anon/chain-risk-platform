package com.chainrisk.batch.job;

import com.chainrisk.batch.model.Transfer;
import com.chainrisk.batch.sink.Neo4jBatchWriter;
import org.apache.spark.api.java.function.ForeachPartitionFunction;
import org.apache.spark.sql.*;
import org.apache.spark.sql.types.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Properties;

/**
 * Transfer Correction Job - Lambda Architecture Batch Layer
 * 
 * This job reads transfers from PostgreSQL (source='stream'),
 * corrects/validates the data, and overwrites with source='batch'.
 * 
 * In production, this would read from blockchain RPC and re-parse everything.
 * For now, we simulate by reading from PostgreSQL and re-writing with source='batch'.
 */
public class TransferCorrectionJob {
    private static final Logger LOG = LoggerFactory.getLogger(TransferCorrectionJob.class);

    public static void main(String[] args) {
        // Parse arguments
        String jdbcUrl = getArg(args, "--jdbc.url", "jdbc:postgresql://localhost:15432/chainrisk");
        String jdbcUser = getArg(args, "--jdbc.user", "chainrisk");
        String jdbcPassword = getArg(args, "--jdbc.password", "chainrisk123");
        String neo4jUri = getArg(args, "--neo4j.uri", "bolt://localhost:17687");
        String neo4jUser = getArg(args, "--neo4j.user", "neo4j");
        String neo4jPassword = getArg(args, "--neo4j.password", "chainrisk123");
        boolean enableNeo4jSink = Boolean.parseBoolean(getArg(args, "--enable.neo4j.sink", "true"));
        String network = getArg(args, "--network", "ethereum");

        LOG.info("=== Starting Lambda Architecture Batch Layer ===");
        LOG.info("PostgreSQL: {}", jdbcUrl);
        LOG.info("Neo4j: {} (enabled: {})", neo4jUri, enableNeo4jSink);
        LOG.info("Network: {}", network);

        // Create Spark session
        SparkSession spark = SparkSession.builder()
                .appName("Lambda Batch Layer - Transfer Correction")
                .config("spark.sql.adaptive.enabled", "true")
                .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
                .getOrCreate();

        try {
            // Step 1: Read transfers from PostgreSQL (source='stream')
            LOG.info("Reading transfers from PostgreSQL (source='stream')...");
            Dataset<Row> streamTransfers = readStreamTransfers(spark, jdbcUrl, jdbcUser, jdbcPassword, network);
            
            long transferCount = streamTransfers.count();
            LOG.info("Found {} stream transfers to correct", transferCount);

            if (transferCount == 0) {
                LOG.warn("No stream transfers found, exiting");
                return;
            }

            // Step 2: Transform and validate data (in production, this would re-parse from blockchain)
            Dataset<Row> correctedTransfers = correctTransfers(streamTransfers);
            
            // Cache the dataset since we'll use it twice (PostgreSQL + Neo4j)
            correctedTransfers.cache();

            // Step 3: Write corrected transfers back to PostgreSQL (source='batch')
            LOG.info("Writing corrected transfers to PostgreSQL...");
            writeToPostgreSQL(correctedTransfers, jdbcUrl, jdbcUser, jdbcPassword);

            // Step 4: Write corrected transfers to Neo4j (source='batch')
            if (enableNeo4jSink) {
                LOG.info("Writing corrected transfers to Neo4j...");
                writeToNeo4j(correctedTransfers, neo4jUri, neo4jUser, neo4jPassword);
            }
            
            // Unpersist the cached dataset
            correctedTransfers.unpersist();

            LOG.info("=== Batch Layer Complete ===");
            LOG.info("Corrected {} transfers", transferCount);

        } catch (Exception e) {
            LOG.error("Batch job failed", e);
            System.exit(1);
        } finally {
            spark.stop();
        }
    }

    /**
     * Read transfers with source='stream' from PostgreSQL
     */
    private static Dataset<Row> readStreamTransfers(SparkSession spark, String jdbcUrl, 
                                                     String user, String password, String network) {
        Properties props = new Properties();
        props.setProperty("user", user);
        props.setProperty("password", password);
        props.setProperty("driver", "org.postgresql.Driver");

        return spark.read()
                .jdbc(jdbcUrl, "chain_data.transfers", props)
                .filter(functions.col("source").equalTo("stream"))
                .filter(functions.col("network").equalTo(network));
    }

    /**
     * Correct and validate transfers
     * In production, this would re-parse from blockchain RPC
     * For now, we just mark as corrected
     */
    private static Dataset<Row> correctTransfers(Dataset<Row> transfers) {
        LOG.info("Applying corrections and validations...");

        // Add corrected_at timestamp
        Dataset<Row> corrected = transfers
                .withColumn("source", functions.lit("batch"))
                .withColumn("corrected_at", functions.current_timestamp());

        // In production, add more validation logic here:
        // - Verify block exists on blockchain
        // - Re-parse transaction logs
        // - Validate addresses
        // - Check for reorgs
        // - Handle complex contracts

        return corrected;
    }

    /**
     * Write corrected transfers to PostgreSQL
     * Uses UPSERT (ON CONFLICT DO UPDATE) to overwrite stream data
     */
    private static void writeToPostgreSQL(Dataset<Row> transfers, String jdbcUrl, 
                                          String user, String password) {
        // Convert to JavaRDD and write with custom UPSERT logic
        transfers.foreachPartition((ForeachPartitionFunction<Row>) partition -> {
            // JDBC connection per partition
            try (Connection conn = DriverManager.getConnection(jdbcUrl, user, password)) {
                conn.setAutoCommit(false);

                String upsertSQL = 
                    "INSERT INTO chain_data.transfers " +
                    "(tx_hash, block_number, log_index, from_address, to_address, value, " +
                    " token_address, token_symbol, token_decimal, timestamp, transfer_type, network, source, corrected_at) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'batch', NOW()) " +
                    "ON CONFLICT (tx_hash, log_index) DO UPDATE SET " +
                    "  from_address = EXCLUDED.from_address, " +
                    "  to_address = EXCLUDED.to_address, " +
                    "  value = EXCLUDED.value, " +
                    "  token_address = EXCLUDED.token_address, " +
                    "  token_symbol = EXCLUDED.token_symbol, " +
                    "  token_decimal = EXCLUDED.token_decimal, " +
                    "  timestamp = EXCLUDED.timestamp, " +
                    "  transfer_type = EXCLUDED.transfer_type, " +
                    "  source = 'batch', " +
                    "  corrected_at = NOW()";

                try (PreparedStatement stmt = conn.prepareStatement(upsertSQL)) {
                    int batchSize = 0;
                    
                    while (partition.hasNext()) {
                        Row row = partition.next();
                        
                        stmt.setString(1, row.getAs("tx_hash"));
                        stmt.setLong(2, row.getAs("block_number"));
                        stmt.setInt(3, row.getAs("log_index"));
                        stmt.setString(4, row.getAs("from_address"));
                        stmt.setString(5, row.getAs("to_address"));
                        
                        // Handle value (BigDecimal from PostgreSQL NUMERIC type)
                        Object value = row.getAs("value");
                        if (value instanceof java.math.BigDecimal) {
                            stmt.setBigDecimal(6, (java.math.BigDecimal) value);
                        } else if (value != null) {
                            stmt.setBigDecimal(6, new java.math.BigDecimal(value.toString()));
                        } else {
                            stmt.setBigDecimal(6, java.math.BigDecimal.ZERO);
                        }
                        
                        stmt.setString(7, row.getAs("token_address"));
                        stmt.setString(8, row.getAs("token_symbol"));
                        
                        Object tokenDecimal = row.getAs("token_decimal");
                        if (tokenDecimal != null) {
                            stmt.setInt(9, (Integer) tokenDecimal);
                        } else {
                            stmt.setNull(9, java.sql.Types.INTEGER);
                        }
                        
                        Timestamp timestamp = row.getAs("timestamp");
                        stmt.setTimestamp(10, timestamp);
                        stmt.setString(11, row.getAs("transfer_type"));
                        stmt.setString(12, row.getAs("network"));
                        
                        stmt.addBatch();
                        batchSize++;
                        
                        if (batchSize >= 1000) {
                            stmt.executeBatch();
                            conn.commit();
                            batchSize = 0;
                        }
                    }
                    
                    if (batchSize > 0) {
                        stmt.executeBatch();
                        conn.commit();
                    }
                }
            } catch (Exception e) {
                LOG.error("Failed to write to PostgreSQL", e);
                throw new RuntimeException(e);
            }
        });

        LOG.info("PostgreSQL write complete");
    }

    /**
     * Write corrected transfers to Neo4j
     * Uses MERGE to overwrite stream data
     */
    private static void writeToNeo4j(Dataset<Row> transfers, String neo4jUri, 
                                     String user, String password) {
        transfers.foreachPartition(new Neo4jBatchWriter(neo4jUri, user, password));
        LOG.info("Neo4j write complete");
    }

    /**
     * Get command line argument with default value
     */
    private static String getArg(String[] args, String key, String defaultValue) {
        for (int i = 0; i < args.length - 1; i++) {
            if (args[i].equals(key)) {
                return args[i + 1];
            }
        }
        return defaultValue;
    }
}
