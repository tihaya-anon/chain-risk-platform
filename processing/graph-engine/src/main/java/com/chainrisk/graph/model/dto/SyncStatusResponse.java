package com.chainrisk.graph.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Response DTO for sync status
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncStatusResponse {

    /**
     * Current sync status
     */
    private String status;

    /**
     * Last synced block number
     */
    private Long lastSyncedBlock;

    /**
     * Total addresses in graph
     */
    private Long totalAddresses;

    /**
     * Total transfers in graph
     */
    private Long totalTransfers;

    /**
     * Last sync timestamp
     */
    private Instant lastSyncTime;

    /**
     * Next scheduled sync time
     */
    private Instant nextSyncTime;

    /**
     * Network being synced
     */
    private String network;

    /**
     * Error message if sync failed
     */
    private String errorMessage;
}
