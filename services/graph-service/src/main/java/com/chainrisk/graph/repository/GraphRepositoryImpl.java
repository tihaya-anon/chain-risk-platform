package com.chainrisk.graph.repository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Result;
import org.neo4j.driver.Values;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Implementation of custom graph operations using Neo4j Driver directly
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class GraphRepositoryImpl {

    private final Driver driver;

    /**
     * Create a transfer relationship between two addresses
     */
    public void createTransfer(String fromAddress, String toAddress, String txHash,
                               String value, Long blockNumber, Instant timestamp,
                               String tokenSymbol, String tokenAddress,
                               String transferType, String network) {
        String cypher = """
            MERGE (from:Address {address: $fromAddress})
            ON CREATE SET from.firstSeen = $timestamp, from.lastSeen = $timestamp, 
                         from.txCount = 1, from.tags = [], from.riskScore = 0.0, from.network = $network
            ON MATCH SET from.lastSeen = CASE WHEN from.lastSeen < $timestamp THEN $timestamp ELSE from.lastSeen END,
                         from.firstSeen = CASE WHEN from.firstSeen > $timestamp THEN $timestamp ELSE from.firstSeen END,
                         from.txCount = coalesce(from.txCount, 0) + 1
            
            MERGE (to:Address {address: $toAddress})
            ON CREATE SET to.firstSeen = $timestamp, to.lastSeen = $timestamp, 
                         to.txCount = 1, from.tags = [], to.riskScore = 0.0, to.network = $network
            ON MATCH SET to.lastSeen = CASE WHEN to.lastSeen < $timestamp THEN $timestamp ELSE to.lastSeen END,
                         to.firstSeen = CASE WHEN to.firstSeen > $timestamp THEN $timestamp ELSE to.firstSeen END,
                         to.txCount = coalesce(to.txCount, 0) + 1
            
            MERGE (from)-[t:TRANSFER {txHash: $txHash}]->(to)
            ON CREATE SET t.value = $value, t.blockNumber = $blockNumber, t.timestamp = $timestamp, 
                          t.tokenSymbol = $tokenSymbol, t.tokenAddress = $tokenAddress, 
                          t.transferType = $transferType, t.network = $network
            """;

        try (Session session = driver.session()) {
            session.run(cypher, Map.of(
                    "fromAddress", fromAddress.toLowerCase(),
                    "toAddress", toAddress.toLowerCase(),
                    "txHash", txHash,
                    "value", value,
                    "blockNumber", blockNumber,
                    "timestamp", timestamp.toEpochMilli(),
                    "tokenSymbol", tokenSymbol != null ? tokenSymbol : "ETH",
                    "tokenAddress", tokenAddress != null ? tokenAddress : "",
                    "transferType", transferType != null ? transferType : "native",
                    "network", network != null ? network : "ethereum"
            ));
        }
    }

    /**
     * Batch create transfers for better performance
     */
    public void batchCreateTransfers(List<TransferData> transfers) {
        String cypher = """
            UNWIND $transfers as transfer
            MERGE (from:Address {address: transfer.fromAddress})
            ON CREATE SET from.firstSeen = transfer.timestamp, from.lastSeen = transfer.timestamp, 
                         from.txCount = 1, from.tags = [], from.riskScore = 0.0, from.network = transfer.network
            ON MATCH SET from.lastSeen = CASE WHEN from.lastSeen < transfer.timestamp THEN transfer.timestamp ELSE from.lastSeen END,
                         from.firstSeen = CASE WHEN from.firstSeen > transfer.timestamp THEN transfer.timestamp ELSE from.firstSeen END,
                         from.txCount = coalesce(from.txCount, 0) + 1
            
            MERGE (to:Address {address: transfer.toAddress})
            ON CREATE SET to.firstSeen = transfer.timestamp, to.lastSeen = transfer.timestamp, 
                         to.txCount = 1, to.tags = [], to.riskScore = 0.0, to.network = transfer.network
            ON MATCH SET to.lastSeen = CASE WHEN to.lastSeen < transfer.timestamp THEN transfer.timestamp ELSE to.lastSeen END,
                         to.firstSeen = CASE WHEN to.firstSeen > transfer.timestamp THEN transfer.timestamp ELSE to.firstSeen END,
                         to.txCount = coalesce(to.txCount, 0) + 1
            
            MERGE (from)-[t:TRANSFER {txHash: transfer.txHash}]->(to)
            ON CREATE SET t.value = transfer.value, t.blockNumber = transfer.blockNumber, 
                          t.timestamp = transfer.timestamp, t.tokenSymbol = transfer.tokenSymbol, 
                          t.tokenAddress = transfer.tokenAddress, t.transferType = transfer.transferType, 
                          t.network = transfer.network
            """;

        List<Map<String, Object>> transferMaps = transfers.stream()
                .map(t -> Map.<String, Object>of(
                        "fromAddress", t.fromAddress().toLowerCase(),
                        "toAddress", t.toAddress().toLowerCase(),
                        "txHash", t.txHash(),
                        "value", t.value(),
                        "blockNumber", t.blockNumber(),
                        "timestamp", t.timestamp().toEpochMilli(),
                        "tokenSymbol", t.tokenSymbol() != null ? t.tokenSymbol() : "ETH",
                        "tokenAddress", t.tokenAddress() != null ? t.tokenAddress() : "",
                        "transferType", t.transferType() != null ? t.transferType() : "native",
                        "network", t.network() != null ? t.network() : "ethereum"
                ))
                .toList();

        try (Session session = driver.session()) {
            session.run(cypher, Map.of("transfers", transferMaps));
            log.debug("Batch created {} transfers", transfers.size());
        }
    }

    /**
     * Count total transfers
     */
    public Long countAllTransfers() {
        try (Session session = driver.session()) {
            Result result = session.run("MATCH ()-[t:TRANSFER]->() RETURN count(t) as count");
            if (result.hasNext()) {
                return result.next().get("count").asLong();
            }
        }
        return 0L;
    }

    /**
     * Get latest block number
     */
    public Long getLatestBlockNumber() {
        try (Session session = driver.session()) {
            Result result = session.run("MATCH ()-[t:TRANSFER]->() RETURN max(t.blockNumber) as maxBlock");
            if (result.hasNext()) {
                var value = result.next().get("maxBlock");
                return value.isNull() ? null : value.asLong();
            }
        }
        return null;
    }

    /**
     * Find common input pairs for clustering
     */
    public List<CommonInputPair> findCommonInputPairs(int minCommonBlocks, int limit) {
        String cypher = """
            MATCH (a1:Address)-[t1:TRANSFER]->()
            MATCH (a2:Address)-[t2:TRANSFER]->()
            WHERE t1.blockNumber = t2.blockNumber 
              AND a1.address < a2.address
              AND (a1.clusterId IS NULL OR a1.clusterId = '')
              AND (a2.clusterId IS NULL OR a2.clusterId = '')
            WITH a1.address as address1, a2.address as address2, count(*) as commonBlocks
            WHERE commonBlocks >= $minCommonBlocks
            RETURN address1, address2, commonBlocks
            ORDER BY commonBlocks DESC
            LIMIT $limit
            """;

        List<CommonInputPair> pairs = new ArrayList<>();
        try (Session session = driver.session()) {
            Result result = session.run(cypher, Map.of(
                    "minCommonBlocks", minCommonBlocks,
                    "limit", limit
            ));
            while (result.hasNext()) {
                var record = result.next();
                pairs.add(new CommonInputPair(
                        record.get("address1").asString(),
                        record.get("address2").asString(),
                        record.get("commonBlocks").asInt()
                ));
            }
        }
        return pairs;
    }

    /**
     * Propagate risk score from source to neighbors
     */
    public int propagateRiskScore(String sourceAddress, int maxHops, double decayFactor, double minThreshold) {
        String cypher = """
            MATCH (source:Address {address: $sourceAddress})
            WHERE source.riskScore IS NOT NULL AND source.riskScore > 0
            CALL {
                WITH source
                MATCH path = (source)-[:TRANSFER*1..%d]-(target:Address)
                WHERE target.address <> source.address
                WITH target, min(length(path)) as minDistance, source.riskScore as sourceRisk
                WITH target, minDistance, sourceRisk * power($decayFactor, minDistance) as propagatedScore
                WHERE propagatedScore >= $minThreshold
                SET target.riskScore = CASE 
                    WHEN target.riskScore IS NULL THEN propagatedScore
                    WHEN target.riskScore < propagatedScore THEN propagatedScore
                    ELSE target.riskScore
                END
                RETURN count(target) as cnt
            }
            RETURN sum(cnt) as affectedCount
            """.formatted(maxHops);

        try (Session session = driver.session()) {
            Result result = session.run(cypher, Map.of(
                    "sourceAddress", sourceAddress.toLowerCase(),
                    "decayFactor", decayFactor,
                    "minThreshold", minThreshold
            ));
            if (result.hasNext()) {
                return result.next().get("affectedCount").asInt();
            }
        }
        return 0;
    }

    /**
     * Transfer data record
     */
    public record TransferData(
            String fromAddress,
            String toAddress,
            String txHash,
            String value,
            Long blockNumber,
            Instant timestamp,
            String tokenSymbol,
            String tokenAddress,
            String transferType,
            String network
    ) {}

    /**
     * Common input pair record
     */
    public record CommonInputPair(
            String address1,
            String address2,
            int commonBlocks
    ) {}
}
