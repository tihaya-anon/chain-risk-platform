package com.chainrisk.graph.repository;

import com.chainrisk.graph.model.node.ClusterNode;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Neo4j Repository for Cluster nodes
 */
@Repository
public interface ClusterRepository extends Neo4jRepository<ClusterNode, String> {

    /**
     * Find cluster by ID
     */
    Optional<ClusterNode> findByClusterId(String clusterId);

    /**
     * Find clusters with specific tag
     */
    @Query("MATCH (c:Cluster) WHERE $tag IN c.tags RETURN c")
    List<ClusterNode> findByTag(@Param("tag") String tag);

    /**
     * Find clusters with risk score above threshold
     */
    @Query("MATCH (c:Cluster) WHERE c.riskScore >= $threshold RETURN c ORDER BY c.riskScore DESC LIMIT $limit")
    List<ClusterNode> findHighRiskClusters(@Param("threshold") Double threshold, @Param("limit") int limit);

    /**
     * Find clusters by category
     */
    List<ClusterNode> findByCategory(String category);

    /**
     * Find clusters larger than specified size
     */
    @Query("MATCH (c:Cluster) WHERE c.size >= $minSize RETURN c ORDER BY c.size DESC LIMIT $limit")
    List<ClusterNode> findLargeClusters(@Param("minSize") int minSize, @Param("limit") int limit);

    /**
     * Get cluster containing specific address
     */
    @Query("""
        MATCH (a:Address {address: $address})
        WHERE a.clusterId IS NOT NULL
        MATCH (c:Cluster {clusterId: a.clusterId})
        RETURN c
        """)
    Optional<ClusterNode> findClusterByAddress(@Param("address") String address);

    /**
     * Get addresses in cluster
     */
    @Query("MATCH (a:Address) WHERE a.clusterId = $clusterId RETURN a.address")
    List<String> findAddressesInCluster(@Param("clusterId") String clusterId);

    /**
     * Count addresses in cluster
     */
    @Query("MATCH (a:Address) WHERE a.clusterId = $clusterId RETURN count(a)")
    Integer countAddressesInCluster(@Param("clusterId") String clusterId);

    /**
     * Get total cluster count
     */
    @Query("MATCH (c:Cluster) RETURN count(c)")
    Long countAllClusters();

    /**
     * Update cluster risk score
     */
    @Query("""
        MATCH (c:Cluster {clusterId: $clusterId})
        OPTIONAL MATCH (a:Address) WHERE a.clusterId = $clusterId
        WITH c, avg(coalesce(a.riskScore, 0)) as avgScore
        SET c.riskScore = avgScore
        RETURN c
        """)
    ClusterNode recalculateRiskScore(@Param("clusterId") String clusterId);

    /**
     * Update cluster size
     */
    @Query("""
        MATCH (c:Cluster {clusterId: $clusterId})
        OPTIONAL MATCH (a:Address) WHERE a.clusterId = $clusterId
        WITH c, count(a) as addressCount
        SET c.size = addressCount
        RETURN c
        """)
    ClusterNode recalculateSize(@Param("clusterId") String clusterId);

    /**
     * Aggregate tags from member addresses
     */
    @Query("""
        MATCH (c:Cluster {clusterId: $clusterId})
        OPTIONAL MATCH (a:Address) WHERE a.clusterId = $clusterId AND a.tags IS NOT NULL
        WITH c, collect(a.tags) as allTags
        UNWIND allTags as tagList
        UNWIND tagList as tag
        WITH c, collect(DISTINCT tag) as uniqueTags
        SET c.tags = uniqueTags
        RETURN c
        """)
    ClusterNode aggregateTags(@Param("clusterId") String clusterId);

    /**
     * Delete empty clusters
     */
    @Query("""
        MATCH (c:Cluster)
        WHERE c.size = 0 OR c.size IS NULL
        DELETE c
        RETURN count(c) as deleted
        """)
    Integer deleteEmptyClusters();

    /**
     * Find clusters by network
     */
    List<ClusterNode> findByNetwork(String network);
}
