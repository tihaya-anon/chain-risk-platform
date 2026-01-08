package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for address neighbors query.
 * Returns a subgraph structure (nodes + edges) suitable for graph visualization.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressNeighborsResponse {

    /**
     * The center address of the BFS query
     */
    private String address;

    /**
     * Query depth used
     */
    private Integer depth;

    /**
     * All nodes in the subgraph (including center)
     */
    private List<GraphNode> nodes;

    /**
     * All edges in the subgraph
     */
    private List<GraphEdge> edges;

    /**
     * Node in the subgraph
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GraphNode {
        /**
         * Address (also serves as node ID)
         */
        private String address;

        /**
         * Distance from center (0 = center node)
         */
        private Integer distance;

        /**
         * Risk score
         */
        private Double riskScore;

        /**
         * Tags
         */
        private List<String> tags;

        /**
         * First seen timestamp
         */
        private Instant firstSeen;

        /**
         * Last seen timestamp
         */
        private Instant lastSeen;
    }

    /**
     * Edge in the subgraph
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GraphEdge {
        /**
         * Source address
         */
        private String from;

        /**
         * Target address
         */
        private String to;

        /**
         * Number of transfers on this edge
         */
        private Integer transferCount;

        /**
         * Total value transferred (in wei as string)
         */
        private String totalValue;

        /**
         * Timestamp of last transfer
         */
        private Instant lastTransfer;
    }
}
