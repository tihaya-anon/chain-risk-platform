package com.chainrisk.stream.sink;

import com.chainrisk.stream.model.Transfer;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.sink.RichSinkFunction;
import org.neo4j.driver.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

import static org.neo4j.driver.Values.parameters;

/**
 * Neo4j Sink for Flink - Dual-write transfers to graph database
 * 
 * Part of Lambda Architecture Speed Layer:
 * - Writes transfer data directly to Neo4j for real-time graph analysis
 * - Creates Address nodes and TRANSFER relationships
 * - Marks data with source='stream' for later batch correction
 */
public class Neo4jTransferSink extends RichSinkFunction<Transfer> {
    private static final Logger LOG = LoggerFactory.getLogger(Neo4jTransferSink.class);

    private final String neo4jUri;
    private final String neo4jUser;
    private final String neo4jPassword;
    
    private transient Driver driver;
    private transient SessionConfig sessionConfig;
    
    // Metrics
    private long successCount = 0;
    private long errorCount = 0;

    public Neo4jTransferSink(String neo4jUri, String neo4jUser, String neo4jPassword) {
        this.neo4jUri = neo4jUri;
        this.neo4jUser = neo4jUser;
        this.neo4jPassword = neo4jPassword;
    }

    @Override
    public void open(Configuration parameters) throws Exception {
        super.open(parameters);
        
        LOG.info("Initializing Neo4j connection to {}", neo4jUri);
        
        // Create Neo4j driver with connection pooling
        driver = GraphDatabase.driver(
                neo4jUri,
                AuthTokens.basic(neo4jUser, neo4jPassword),
                Config.builder()
                        .withMaxConnectionPoolSize(10)
                        .withConnectionAcquisitionTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                        .withMaxConnectionLifetime(1, java.util.concurrent.TimeUnit.HOURS)
                        .withConnectionTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .build()
        );
        
        // Verify connectivity
        driver.verifyConnectivity();
        
        sessionConfig = SessionConfig.builder()
                .withDatabase("neo4j")
                .build();
        
        LOG.info("Neo4j connection established successfully");
    }

    @Override
    public void invoke(Transfer transfer, Context context) throws Exception {
        try (Session session = driver.session(sessionConfig)) {
            // Write transfer to Neo4j using Cypher
            session.executeWrite(tx -> {
                String cypher = buildCypherQuery();
                Map<String, Object> params = buildParameters(transfer);
                
                tx.run(cypher, params);
                return null;
            });
            
            successCount++;
            
            if (successCount % 1000 == 0) {
                LOG.info("Neo4j sink processed {} transfers (errors: {})", successCount, errorCount);
            }
            
        } catch (Exception e) {
            errorCount++;
            LOG.error("Failed to write transfer {} to Neo4j: {}", 
                    transfer.getTxHash(), e.getMessage(), e);
            
            // Don't throw exception to avoid job failure
            // In production, consider using dead letter queue
        }
    }

    /**
     * Build Cypher query for creating/updating transfer graph
     * 
     * Strategy:
     * - MERGE Address nodes (create if not exists)
     * - Set initial properties on CREATE
     * - Update last_seen on MATCH
     * - MERGE TRANSFER relationship
     * - Mark with source='stream' for batch correction
     */
    private String buildCypherQuery() {
        return """
            // Create or update FROM address
            MERGE (from:Address {address: $fromAddr, network: $network})
            ON CREATE SET 
                from.first_seen = timestamp(),
                from.risk_score = 0.0,
                from.tags = [],
                from.source = 'stream',
                from.created_at = timestamp()
            ON MATCH SET 
                from.last_seen = timestamp(),
                from.updated_at = timestamp()
            
            // Create or update TO address
            MERGE (to:Address {address: $toAddr, network: $network})
            ON CREATE SET 
                to.first_seen = timestamp(),
                to.risk_score = 0.0,
                to.tags = [],
                to.source = 'stream',
                to.created_at = timestamp()
            ON MATCH SET 
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
                r.source = 'stream',
                r.created_at = timestamp()
            ON MATCH SET 
                r.updated_at = timestamp()
            """;
    }

    /**
     * Build parameters for Cypher query
     */
    private Map<String, Object> buildParameters(Transfer transfer) {
        Map<String, Object> params = new HashMap<>();
        
        // Address parameters
        params.put("fromAddr", transfer.getFromAddress());
        params.put("toAddr", transfer.getToAddress());
        params.put("network", transfer.getNetwork());
        
        // Transfer parameters
        params.put("txHash", transfer.getTxHash());
        params.put("logIndex", transfer.getLogIndex() != null ? transfer.getLogIndex() : 0);
        params.put("blockNumber", transfer.getBlockNumber());
        params.put("amount", transfer.getValue() != null ? transfer.getValue().toString() : "0");
        params.put("timestamp", transfer.getTimestamp() != null ? 
                transfer.getTimestamp().getEpochSecond() : System.currentTimeMillis() / 1000);
        params.put("tokenAddress", transfer.getTokenAddress());
        params.put("tokenSymbol", transfer.getTokenSymbol());
        params.put("transferType", transfer.getTransferType());
        
        return params;
    }

    @Override
    public void close() throws Exception {
        if (driver != null) {
            LOG.info("Closing Neo4j connection. Final stats - Success: {}, Errors: {}", 
                    successCount, errorCount);
            driver.close();
        }
        super.close();
    }
}
