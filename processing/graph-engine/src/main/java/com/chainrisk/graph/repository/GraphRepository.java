package com.chainrisk.graph.repository;

import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Custom repository for graph-wide queries and operations
 */
@Repository
public interface GraphRepository {

    /**
     * Create a transfer relationship between two addresses
     */
    @Query("""
        MERGE (from:Address {address: $fromAddress})
        ON CREATE SET from.firstSeen = $timestamp, from.lastSeen = $timestamp, from.txCount = 1, from.tags = [], from.riskScore = 0.0, from.network = $network
        ON MATCH SET from.lastSeen = CASE WHEN from.lastSeen < $timestamp THEN $timestamp ELSE from.lastSeen END,
                     from.firstSeen = CASE WHEN from.firstSeen > $timestamp THEN $timestamp ELSE from.firstSeen END,
                     from.txCount = coalesce(from.txCount, 0) + 1
        
        MERGE (to:Address {address: $toAddress})
        ON CREATE SET to.firstSeen = $timestamp, to.lastSeen = $timestamp, to.txCount = 1, to.tags = [], to.riskScore = 0.0, to.network = $network
        ON MATCH SET to.lastSeen = CASE WHEN to.lastSeen < $timestamp THEN $timestamp ELSE to.lastSeen END,
                     to.firstSeen = CASE WHEN to.firstSeen > $timestamp THEN $timestamp ELSE to.firstSeen END,
                     to.txCount = coalesce(to.txCount, 0) + 1
        
        MERGE (from)-[t:TRANSFER {txHash: $txHash}]->(to)
        ON CREATE SET t.value = $value, t.blockNumber = $blockNumber, t.timestamp = $timestamp, 
                      t.tokenSymbol = $tokenSymbol, t.tokenAddress = $tokenAddress, 
                      t.transferType = $transferType, t.network = $network
        
        RETURN from, to, t
        """)
    void createTransfer(
            @Param("fromAddress") String fromAddress,
            @Param("toAddress") String toAddress,
            @Param("txHash") String txHash,
            @Param("value") String value,
            @Param("blockNumber") Long blockNumber,
            @Param("timestamp") java.time.Instant timestamp,
            @Param("tokenSymbol") String tokenSymbol,
            @Param("tokenAddress") String tokenAddress,
            @Param("transferType") String transferType,
            @Param("network") String network
    );

    /**
     * Count total transfers in the graph
     */
    @Query("MATCH ()-[t:TRANSFER]->() RETURN count(t)")
    Long countAllTransfers();

    /**
     * Get the latest block number in the graph
     */
    @Query("MATCH ()-[t:TRANSFER]->() RETURN max(t.blockNumber)")
    Long getLatestBlockNumber();

    /**
     * Find addresses that appear together as senders in the same block
     * (Common input heuristic for clustering)
     */
    @Query("""
        MATCH (a1:Address)-[t1:TRANSFER]->(x)
        MATCH (a2:Address)-[t2:TRANSFER]->(y)
        WHERE t1.blockNumber = t2.blockNumber 
          AND a1.address < a2.address
          AND a1.clusterId IS NULL
          AND a2.clusterId IS NULL
        WITH a1, a2, count(*) as commonBlocks
        WHERE commonBlocks >= $minCommonBlocks
        RETURN a1.address as address1, a2.address as address2, commonBlocks
        LIMIT $limit
        """)
    java.util.List<CommonInputProjection> findCommonInputPairs(
            @Param("minCommonBlocks") int minCommonBlocks,
            @Param("limit") int limit
    );

    /**
     * Propagate tags from source address to neighbors within max hops
     */
    @Query("""
        MATCH (source:Address {address: $sourceAddress})
        WHERE source.tags IS NOT NULL AND size(source.tags) > 0
        MATCH path = (source)-[:TRANSFER*1..%s]-(target:Address)
        WHERE target.address <> source.address
        WITH target, length(path) as distance, source.tags as sourceTags, source.riskScore as sourceRisk
        WITH target, min(distance) as minDistance, sourceTags, sourceRisk
        WHERE minDistance <= $maxHops
        WITH target, minDistance, sourceTags, sourceRisk, 
             sourceRisk * power($decayFactor, minDistance) as propagatedScore
        WHERE propagatedScore >= $minThreshold
        SET target.riskScore = CASE 
            WHEN target.riskScore IS NULL THEN propagatedScore
            WHEN target.riskScore < propagatedScore THEN propagatedScore
            ELSE target.riskScore
        END
        RETURN count(target) as affectedCount
        """)
    Integer propagateTags(
            @Param("sourceAddress") String sourceAddress,
            @Param("maxHops") int maxHops,
            @Param("decayFactor") double decayFactor,
            @Param("minThreshold") double minThreshold
    );

    /**
     * Clear all data (use with caution!)
     */
    @Query("MATCH (n) DETACH DELETE n")
    void clearAllData();

    /**
     * Projection for common input pairs
     */
    interface CommonInputProjection {
        String getAddress1();
        String getAddress2();
        Integer getCommonBlocks();
    }
}
