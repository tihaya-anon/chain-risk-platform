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

/**
 * Neo4j Batch Writer for Spark
 * 
 * Writes corrected transfers to Neo4j with risk scoring data.
 * Used by HudiBatchCorrectionJob to sync risk scores to graph database.
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

    private void writeTransfer(Session session, Row row) {
        String cypher = buildCypherQuery();
        Map<String, Object> params = buildParameters(row);
        
        session.executeWrite(tx -> {
            tx.run(cypher, params);
            return null;
        });
    }

    /**
     * Build Cypher query for batch correction with risk scoring.
     * Updates addresses with risk scores and transfer relationships.
     */
    private String buildCypherQuery() {
        return """
            // Create or update FROM address with risk data
            MERGE (from:Address {address: $fromAddr, network: $network})
            ON CREATE SET 
                from.first_seen = timestamp(),
                from.risk_score = $riskScore,
                from.risk_category = $riskCategory,
                from.is_exchange = $isExchange,
                from.tags = [],
                from.source = 'batch',
                from.created_at = timestamp()
            ON MATCH SET 
                from.risk_score = $riskScore,
                from.risk_category = $riskCategory,
                from.is_exchange = $isExchange,
                from.source = 'batch',
                from.corrected_at = timestamp(),
                from.last_seen = timestamp(),
                from.updated_at = timestamp()
            
            // Create or update TO address with risk data
            MERGE (to:Address {address: $toAddr, network: $network})
            ON CREATE SET 
                to.first_seen = timestamp(),
                to.risk_score = $riskScore,
                to.risk_category = $riskCategory,
                to.is_exchange = $isExchange,
                to.tags = [],
                to.source = 'batch',
                to.created_at = timestamp()
            ON MATCH SET 
                to.risk_score = $riskScore,
                to.risk_category = $riskCategory,
                to.is_exchange = $isExchange,
                to.source = 'batch',
                to.corrected_at = timestamp(),
                to.last_seen = timestamp(),
                to.updated_at = timestamp()
            
            // Create or update TRANSFER relationship with risk score
            MERGE (from)-[r:TRANSFER {tx_hash: $txHash, log_index: $logIndex}]->(to)
            ON CREATE SET 
                r.block_number = $blockNumber,
                r.amount = $amount,
                r.timestamp = $timestamp,
                r.token_address = $tokenAddress,
                r.token_symbol = $tokenSymbol,
                r.transfer_type = $transferType,
                r.risk_score = $riskScore,
                r.risk_category = $riskCategory,
                r.source = 'batch',
                r.created_at = timestamp()
            ON MATCH SET 
                r.block_number = $blockNumber,
                r.amount = $amount,
                r.timestamp = $timestamp,
                r.token_address = $tokenAddress,
                r.token_symbol = $tokenSymbol,
                r.transfer_type = $transferType,
                r.risk_score = $riskScore,
                r.risk_category = $riskCategory,
                r.source = 'batch',
                r.corrected_at = timestamp(),
                r.updated_at = timestamp()
            """;
    }

    /**
     * Build parameters for Cypher query from Spark Row.
     * Handles both old schema (without risk fields) and new schema (with risk fields).
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
        
        // Convert BigDecimal/String to String for Neo4j
        Object value = row.getAs("value");
        params.put("amount", value != null ? value.toString() : "0");
        
        // Convert Timestamp to epoch seconds
        Object timestamp = row.getAs("timestamp");
        if (timestamp instanceof Timestamp) {
            params.put("timestamp", ((Timestamp) timestamp).getTime() / 1000);
        } else if (timestamp instanceof Long) {
            params.put("timestamp", timestamp);
        } else {
            params.put("timestamp", System.currentTimeMillis() / 1000);
        }
        
        params.put("tokenAddress", row.getAs("token_address"));
        params.put("tokenSymbol", row.getAs("token_symbol"));
        params.put("transferType", row.getAs("transfer_type"));
        
        // Risk scoring fields (with defaults for backward compatibility)
        params.put("riskScore", getFieldOrDefault(row, "risk_score", 0));
        params.put("riskCategory", getFieldOrDefault(row, "risk_category", "UNKNOWN"));
        params.put("isExchange", getFieldOrDefault(row, "is_exchange", false));
        
        return params;
    }

    /**
     * Safely get field value with default if not present or null.
     */
    private Object getFieldOrDefault(Row row, String fieldName, Object defaultValue) {
        try {
            int idx = row.fieldIndex(fieldName);
            Object value = row.get(idx);
            return value != null ? value : defaultValue;
        } catch (IllegalArgumentException e) {
            // Field doesn't exist in schema
            return defaultValue;
        }
    }
}
