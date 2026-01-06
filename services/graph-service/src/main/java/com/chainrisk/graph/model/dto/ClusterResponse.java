package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for cluster query
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClusterResponse {

    /**
     * Cluster identifier
     */
    private String clusterId;

    /**
     * Number of addresses in the cluster
     */
    private Integer size;

    /**
     * Aggregated risk score
     */
    private Double riskScore;

    /**
     * Cluster label (if any)
     */
    private String label;

    /**
     * Cluster category
     */
    private String category;

    /**
     * Tags associated with the cluster
     */
    private List<String> tags;

    /**
     * Addresses in the cluster (may be limited)
     */
    private List<String> addresses;

    /**
     * When the cluster was created
     */
    private Instant createdAt;

    /**
     * When the cluster was last updated
     */
    private Instant updatedAt;

    /**
     * Network
     */
    private String network;
}
