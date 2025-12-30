package com.chainrisk.graph.repository;

import com.chainrisk.graph.model.node.AddressNode;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Neo4j Repository for Address nodes
 */
@Repository
public interface AddressRepository extends Neo4jRepository<AddressNode, String> {

    /**
     * Find address by address string (case-insensitive)
     */
    @Query("MATCH (a:Address) WHERE toLower(a.address) = toLower($address) RETURN a")
    Optional<AddressNode> findByAddressIgnoreCase(@Param("address") String address);

    /**
     * Find addresses by cluster ID
     */
    @Query("MATCH (a:Address) WHERE a.clusterId = $clusterId RETURN a")
    List<AddressNode> findByClusterId(@Param("clusterId") String clusterId);

    /**
     * Find addresses with specific tag
     */
    @Query("MATCH (a:Address) WHERE $tag IN a.tags RETURN a")
    List<AddressNode> findByTag(@Param("tag") String tag);

    /**
     * Find addresses with risk score above threshold
     */
    @Query("MATCH (a:Address) WHERE a.riskScore >= $threshold RETURN a ORDER BY a.riskScore DESC LIMIT $limit")
    List<AddressNode> findHighRiskAddresses(@Param("threshold") Double threshold, @Param("limit") int limit);

    /**
     * Get outgoing neighbors of an address
     */
    @Query("""
        MATCH (a:Address {address: $address})-[t:TRANSFER]->(neighbor:Address)
        WITH neighbor, count(t) as transferCount, sum(toFloat(t.value)) as totalValue, max(t.timestamp) as lastTransfer
        RETURN neighbor, transferCount, totalValue, lastTransfer
        ORDER BY transferCount DESC
        LIMIT $limit
        """)
    List<NeighborProjection> findOutgoingNeighbors(@Param("address") String address, @Param("limit") int limit);

    /**
     * Get incoming neighbors of an address
     */
    @Query("""
        MATCH (neighbor:Address)-[t:TRANSFER]->(b:Address {address: $address})
        WITH neighbor, count(t) as transferCount, sum(toFloat(t.value)) as totalValue, max(t.timestamp) as lastTransfer
        RETURN neighbor, transferCount, totalValue, lastTransfer
        ORDER BY transferCount DESC
        LIMIT $limit
        """)
    List<NeighborProjection> findIncomingNeighbors(@Param("address") String address, @Param("limit") int limit);

    /**
     * Count outgoing transfers
     */
    @Query("MATCH (a:Address {address: $address})-[t:TRANSFER]->() RETURN count(t)")
    Integer countOutgoingTransfers(@Param("address") String address);

    /**
     * Count incoming transfers
     */
    @Query("MATCH ()-[t:TRANSFER]->(a:Address {address: $address}) RETURN count(t)")
    Integer countIncomingTransfers(@Param("address") String address);

    /**
     * Find shortest path between two addresses
     */
    @Query("""
        MATCH path = shortestPath((a:Address {address: $fromAddress})-[t:TRANSFER*1..%s]->(b:Address {address: $toAddress}))
        RETURN path
        """)
    List<Object> findShortestPath(@Param("fromAddress") String fromAddress, 
                                   @Param("toAddress") String toAddress,
                                   @Param("maxDepth") int maxDepth);

    /**
     * Get total address count
     */
    @Query("MATCH (a:Address) RETURN count(a)")
    Long countAllAddresses();

    /**
     * Get addresses without cluster
     */
    @Query("MATCH (a:Address) WHERE a.clusterId IS NULL RETURN a LIMIT $limit")
    List<AddressNode> findAddressesWithoutCluster(@Param("limit") int limit);

    /**
     * Update cluster ID for address
     */
    @Query("MATCH (a:Address {address: $address}) SET a.clusterId = $clusterId RETURN a")
    AddressNode updateClusterId(@Param("address") String address, @Param("clusterId") String clusterId);

    /**
     * Add tag to address
     */
    @Query("""
        MATCH (a:Address {address: $address})
        SET a.tags = CASE WHEN $tag IN a.tags THEN a.tags ELSE coalesce(a.tags, []) + $tag END,
            a.tagsString = CASE WHEN a.tagsString IS NULL THEN $tag ELSE a.tagsString + ' ' + $tag END
        RETURN a
        """)
    AddressNode addTag(@Param("address") String address, @Param("tag") String tag);

    /**
     * Remove tag from address
     */
    @Query("""
        MATCH (a:Address {address: $address})
        SET a.tags = [t IN a.tags WHERE t <> $tag]
        RETURN a
        """)
    AddressNode removeTag(@Param("address") String address, @Param("tag") String tag);

    /**
     * Update risk score
     */
    @Query("MATCH (a:Address {address: $address}) SET a.riskScore = $riskScore RETURN a")
    AddressNode updateRiskScore(@Param("address") String address, @Param("riskScore") Double riskScore);

    /**
     * Projection interface for neighbor queries
     */
    interface NeighborProjection {
        AddressNode getNeighbor();
        Integer getTransferCount();
        Double getTotalValue();
        java.time.Instant getLastTransfer();
    }
}
