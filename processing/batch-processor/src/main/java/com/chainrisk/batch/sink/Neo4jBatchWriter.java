package com.chainrisk.batch.sink;

import org.apache.spark.api.java.function.ForeachPartitionFunction;
import org.apache.spark.sql.Row;
import org.neo4j.driver.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import static org.neo4j.driver.Values.parameters;

/**
 * Neo4j Batch Writer for Spark
 * 
 * Writes corrected transfers to Neo4j with source='batch'
 * Overwrites stream data using MERGE
 */
public class Neo4jBatchWriter implements ForeachPartitionFunction<Row> {
    private static final Logger LOG = LoggerFactory.getLogger(Neo4jBatchWriter.class);

    private final String neo4jUri;
    private final String neo4jUser;
    private final String neo4jPassword;

    public Neo4jBatchWriter(String neo4jUri, String neo4jUser, String neo4jPassword) {
        this.neo4jUri = neo4jUri;
        this.neo4jUser = neo4jUser;
        this.neo4jPassword = neo4jPassword;
    }

    @Override
    public void call(Iterator<Row> partition) throws Exception {
        // Create Neo4j driver per partition
        Driver driver = null;
        Session session = null;
        
        try {
            driver = GraphDatabase.driver(
                    neo4jUri,
                    AuthTokens.basic(neo4jUser, neo4jPassword),
                    Config.builder()
                            .withMaxConnectionPoolSize(10)
                            .withConnectionAcquisitionTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                            .build()
            );

            session = driver.session(SessionConfig.builder()
                    .withDatabase("neo4j")
                    .build());

            int count = 0;
            
            while (partition.hasNext()) {
                Row row = partition.next();
                
                try {
                    writeTransfer(session, row);
                    count++;
                    
                    if (count % 100 == 0) {
                        LOG.debug("Processed {} transfers in partition", count);
                    }
                } catch (Exception e) {
                    LOG.error("Failed to write transfer {}: {}", 
                            row.getAs("tx_hash"), e.getMessage());
                    // Continue processing other transfers
                }
            }
            
            LOG.info("Partition complete: {} transfers written to Neo4j", count);
            
        } finally {
            if (session != null) {
                session.close();
            }
            if (driver != null) {
                driver.close();
            }
        }
    }

    /**
     * Write a single transfer to Neo4j
     */
    private void writeTransfer(Session session, Row row) {
        String cypher = buildCypherQuery();
        Map<String, Object> params = buildParameters(row);
        
        session.executeWrite(tx -> {
            tx.run(cypher, params);
            return null;
        });
    }

    /**
     * Build Cypher query for batch correction
     * Uses MERGE to create or update nodes and relationships
     * Marks with source='batch' to overwrite stream data
     */
    private String buildCypherQuery() {
        return """
            // Create or update FROM address
            MERGE (from:Address {address: $fromAddr, network: $network})
            ON CREATE SET 
                from.first_seen = timestamp(),
                from.risk_score = 0.0,
                from.tags = [],
                from.source = 'batch',
                from.created_at = timestamp()
            ON MATCH SET 
                from.source = 'batch',
                from.corrected_at = timestamp(),
                from.last_seen = timestamp(),
                from.updated_at = timestamp()
            
            // Create or update TO address
            MERGE (to:Address {address: $toAddr, network: $network})
            ON CREATE SET 
                to.first_seen = timestamp(),
                to.risk_score = 0.0,
                to.tags = [],
                to.source = 'batch',
                to.created_at = timestamp()
            ON MATCH SET 
                to.source = 'batch',
                to.corrected_at = timestamp(),
                to.last_seen = timestamp(),
                to.updated_at = timestamp()
            
            // Create or update TRANSFER relationship
            MERGE (from)-[r:TRANSFER {tx_hash: $txHash, log_index: $logIndex}]->(to)
            ON CREATE SET 
                r.block_number = $blockNumber,
                r.amount = $amount,
                r.timestamp = $timestamp,
                r.token_address = $tokenAddress,
                r.token_symbol = $tokenSymbol,
                r.transfer_type = $transferType,
                r.source = 'batch',
                r.created_at = timestamp()
            ON MATCH SET 
                r.block_number = $blockNumber,
                r.amount = $amount,
                r.timestamp = $timestamp,
                r.token_address = $tokenAddress,
                r.token_symbol = $tokenSymbol,
                r.transfer_type = $transferType,
                r.source = 'batch',
                r.corrected_at = timestamp(),
                r.updated_at = timestamp()
            """;
    }

    /**
     * Build parameters for Cypher query from Spark Row
     */
    private Map<String, Object> buildParameters(Row row) {
        Map<String, Object> params = new HashMap<>();
        
        // Address parameters
        params.put("fromAddr", row.getAs("from_address"));
        params.put("toAddr", row.getAs("to_address"));
        params.put("network", row.getAs("network"));
        
        // Transfer parameters
        params.put("txHash", row.getAs("tx_hash"));
        
        Object logIndex = row.getAs("log_index");
        params.put("logIndex", logIndex != null ? logIndex : 0);
        
        params.put("blockNumber", row.getAs("block_number"));
        
        // Convert BigDecimal to String for Neo4j
        Object value = row.getAs("value");
        if (value != null) {
            params.put("amount", value.toString());
        } else {
            params.put("amount", "0");
        }
        
        // Convert Timestamp to epoch seconds
        Timestamp timestamp = row.getAs("timestamp");
        params.put("timestamp", timestamp != null ? timestamp.getTime() / 1000 : System.currentTimeMillis() / 1000);
        
        params.put("tokenAddress", row.getAs("token_address"));
        params.put("tokenSymbol", row.getAs("token_symbol"));
        params.put("transferType", row.getAs("transfer_type"));
        
        return params;
    }
}
