package com.chainrisk.graph.service;

import com.chainrisk.graph.model.dto.*;
import com.chainrisk.graph.model.node.AddressNode;
import com.chainrisk.graph.model.node.ClusterNode;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for graph query operations
 */
public interface GraphQueryService {

    /**
     * Get address information
     */
    Optional<AddressInfoResponse> getAddressInfo(String address);

    /**
     * Get neighbors of an address
     */
    AddressNeighborsResponse getNeighbors(String address, int depth, int limit);

    /**
     * Get cluster information for an address
     */
    Optional<ClusterResponse> getClusterForAddress(String address);

    /**
     * Get cluster by ID
     */
    Optional<ClusterResponse> getClusterById(String clusterId);

    /**
     * Find path between two addresses
     */
    PathResponse findPath(String fromAddress, String toAddress, int maxDepth);

    /**
     * Search addresses by tag
     */
    List<AddressInfoResponse> searchByTag(String tag, int limit);

    /**
     * Get high risk addresses
     */
    List<AddressInfoResponse> getHighRiskAddresses(double threshold, int limit);
}
