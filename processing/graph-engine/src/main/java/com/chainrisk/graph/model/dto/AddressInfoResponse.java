package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for address info including tags
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressInfoResponse {

    /**
     * The address
     */
    private String address;

    /**
     * First seen timestamp
     */
    private Instant firstSeen;

    /**
     * Last seen timestamp
     */
    private Instant lastSeen;

    /**
     * Transaction count
     */
    private Long txCount;

    /**
     * Risk score
     */
    private Double riskScore;

    /**
     * Tags
     */
    private List<String> tags;

    /**
     * Cluster ID (if belongs to a cluster)
     */
    private String clusterId;

    /**
     * Network
     */
    private String network;

    /**
     * Number of incoming transfers
     */
    private Integer incomingCount;

    /**
     * Number of outgoing transfers
     */
    private Integer outgoingCount;
}
