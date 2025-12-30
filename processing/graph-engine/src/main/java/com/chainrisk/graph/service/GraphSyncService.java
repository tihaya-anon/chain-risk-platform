package com.chainrisk.graph.service;

import com.chainrisk.graph.model.dto.SyncStatusResponse;

/**
 * Service interface for syncing data from PostgreSQL to Neo4j
 */
public interface GraphSyncService {

    /**
     * Perform incremental sync from PostgreSQL to Neo4j
     * @return number of transfers synced
     */
    int syncTransfers();

    /**
     * Perform full sync (reset and sync all data)
     * @return number of transfers synced
     */
    int fullSync();

    /**
     * Get current sync status
     */
    SyncStatusResponse getSyncStatus();

    /**
     * Check if sync is currently running
     */
    boolean isSyncRunning();

    /**
     * Trigger manual sync
     */
    SyncStatusResponse triggerSync();
}
