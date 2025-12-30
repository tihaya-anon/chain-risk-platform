package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Response DTO for clustering operation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClusteringResultResponse {

    /**
     * Status of the clustering operation
     */
    private String status;

    /**
     * Number of clusters created/updated
     */
    private Integer clustersCreated;

    /**
     * Number of addresses clustered
     */
    private Integer addressesClustered;

    /**
     * Time taken in milliseconds
     */
    private Long durationMs;

    /**
     * Timestamp when clustering started
     */
    private Instant startedAt;

    /**
     * Timestamp when clustering completed
     */
    private Instant completedAt;

    /**
     * Error message if failed
     */
    private String errorMessage;
}
