package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for path query between two addresses
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PathResponse {

    /**
     * Whether a path was found
     */
    private boolean found;

    /**
     * Source address
     */
    private String fromAddress;

    /**
     * Target address
     */
    private String toAddress;

    /**
     * Length of the path (number of hops)
     */
    private Integer pathLength;

    /**
     * Maximum depth searched
     */
    private Integer maxDepth;

    /**
     * Path nodes and edges
     */
    private List<PathNode> path;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PathNode {
        /**
         * Address at this step
         */
        private String address;

        /**
         * Transaction hash connecting to next node (null for last node)
         */
        private String txHash;

        /**
         * Value transferred (null for last node)
         */
        private String value;

        /**
         * Timestamp of transfer (null for last node)
         */
        private Instant timestamp;

        /**
         * Risk score of this address
         */
        private Double riskScore;

        /**
         * Tags of this address
         */
        private List<String> tags;
    }
}
