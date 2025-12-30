package com.chainrisk.graph.service;

import com.chainrisk.graph.model.dto.ClusteringResultResponse;

/**
 * Service interface for address clustering operations
 */
public interface ClusteringService {

    /**
     * Run clustering algorithm on all unclustered addresses
     * @return clustering result with statistics
     */
    ClusteringResultResponse runClustering();

    /**
     * Run clustering on a specific set of addresses
     * @param addresses list of addresses to cluster
     * @return clustering result
     */
    ClusteringResultResponse clusterAddresses(java.util.List<String> addresses);

    /**
     * Get cluster for a specific address
     * @param address the address to look up
     * @return cluster ID or null if not clustered
     */
    String getClusterForAddress(String address);

    /**
     * Merge two clusters
     * @param clusterId1 first cluster ID
     * @param clusterId2 second cluster ID
     * @return the merged cluster ID
     */
    String mergeClusters(String clusterId1, String clusterId2);

    /**
     * Remove an address from its cluster
     * @param address the address to remove
     * @return true if removed successfully
     */
    boolean removeFromCluster(String address);
}
