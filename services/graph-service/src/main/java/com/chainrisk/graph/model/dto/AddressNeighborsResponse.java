package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for address neighbors query
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressNeighborsResponse {

    /**
     * The queried address
     */
    private String address;

    /**
     * List of neighboring addresses
     */
    private List<NeighborInfo> neighbors;

    /**
     * Total count of neighbors (may be more than returned if limited)
     */
    private Integer totalCount;

    /**
     * Query depth used
     */
    private Integer depth;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NeighborInfo {
        /**
         * Neighbor address
         */
        private String address;

        /**
         * Direction of transfer (incoming/outgoing)
         */
        private String direction;

        /**
         * Number of transfers between addresses
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

        /**
         * Risk score of the neighbor
         */
        private Double riskScore;

        /**
         * Tags of the neighbor
         */
        private List<String> tags;
    }
}
