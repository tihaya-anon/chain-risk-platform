package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Response DTO for tag propagation operation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PropagationResultResponse {

    /**
     * Status of the propagation operation
     */
    private String status;

    /**
     * Number of addresses affected
     */
    private Integer addressesAffected;

    /**
     * Number of tags propagated
     */
    private Integer tagsPropagated;

    /**
     * Maximum hops used
     */
    private Integer maxHops;

    /**
     * Decay factor used
     */
    private Double decayFactor;

    /**
     * Time taken in milliseconds
     */
    private Long durationMs;

    /**
     * Timestamp when propagation started
     */
    private Instant startedAt;

    /**
     * Timestamp when propagation completed
     */
    private Instant completedAt;

    /**
     * Error message if failed
     */
    private String errorMessage;
}
