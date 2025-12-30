package com.chainrisk.graph.service.impl;

import com.chainrisk.graph.config.GraphProperties;
import com.chainrisk.graph.model.dto.SyncStatusResponse;
import com.chainrisk.graph.repository.GraphRepositoryImpl;
import com.chainrisk.graph.repository.GraphRepositoryImpl.TransferData;
import com.chainrisk.graph.service.GraphSyncService;
import com.chainrisk.graph.sync.PostgresTransferReader;
import com.chainrisk.graph.sync.PostgresTransferReader.TransferRecord;
import com.chainrisk.graph.sync.SyncStateTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Implementation of GraphSyncService
 * Syncs transfer data from PostgreSQL to Neo4j on a scheduled basis
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GraphSyncServiceImpl implements GraphSyncService {

    private final PostgresTransferReader transferReader;
    private final SyncStateTracker syncStateTracker;
    private final GraphRepositoryImpl graphRepository;
    private final GraphProperties graphProperties;

    private final AtomicBoolean syncRunning = new AtomicBoolean(false);
    private volatile Instant lastSyncTime;
    private volatile String lastError;

    @Override
    @Scheduled(fixedDelayString = "${graph.sync.interval:300000}", initialDelay = 10000)
    public int syncTransfers() {
        if (!graphProperties.getSync().isEnabled()) {
            log.debug("Sync is disabled");
            return 0;
        }

        if (!syncRunning.compareAndSet(false, true)) {
            log.warn("Sync already running, skipping this iteration");
            return 0;
        }

        try {
            return doSync();
        } catch (Exception e) {
            log.error("Sync failed", e);
            lastError = e.getMessage();
            return 0;
        } finally {
            syncRunning.set(false);
            lastSyncTime = Instant.now();
        }
    }

    private int doSync() {
        String network = graphProperties.getSync().getNetwork();
        int batchSize = graphProperties.getSync().getBatchSize();

        // Get last synced block
        Long lastSyncedBlock = syncStateTracker.getLastSyncedBlock(network).orElse(0L);
        log.info("Starting sync from block {} for network {}", lastSyncedBlock, network);

        // Check if there's new data
        Long latestBlock = transferReader.getLatestBlockNumber(network);
        if (latestBlock == null || latestBlock <= lastSyncedBlock) {
            log.debug("No new data to sync. Latest block: {}, last synced: {}", latestBlock, lastSyncedBlock);
            return 0;
        }

        int totalSynced = 0;
        Long currentBlock = lastSyncedBlock;

        // Sync in batches
        while (true) {
            List<TransferRecord> transfers = transferReader.readTransfers(currentBlock, batchSize, network);
            
            if (transfers.isEmpty()) {
                break;
            }

            // Convert to TransferData and batch insert
            List<TransferData> transferDataList = transfers.stream()
                    .map(this::toTransferData)
                    .toList();

            graphRepository.batchCreateTransfers(transferDataList);
            totalSynced += transfers.size();

            // Update current block to the last one in this batch
            currentBlock = transfers.get(transfers.size() - 1).blockNumber();

            log.debug("Synced {} transfers, current block: {}", transfers.size(), currentBlock);

            // Update sync state periodically
            if (totalSynced % (batchSize * 10) == 0) {
                syncStateTracker.updateLastSyncedBlock(currentBlock, network);
            }

            // If we got less than batch size, we've reached the end
            if (transfers.size() < batchSize) {
                break;
            }
        }

        // Final state update
        if (totalSynced > 0) {
            syncStateTracker.updateLastSyncedBlock(currentBlock, network);
            log.info("Sync completed. Total transfers synced: {}, last block: {}", totalSynced, currentBlock);
        }

        lastError = null;
        return totalSynced;
    }

    @Override
    public int fullSync() {
        if (!syncRunning.compareAndSet(false, true)) {
            throw new IllegalStateException("Sync already running");
        }

        try {
            String network = graphProperties.getSync().getNetwork();
            
            // Reset sync state
            syncStateTracker.resetSyncState(network);
            log.info("Starting full sync for network {}", network);

            return doSync();
        } finally {
            syncRunning.set(false);
            lastSyncTime = Instant.now();
        }
    }

    @Override
    public SyncStatusResponse getSyncStatus() {
        String network = graphProperties.getSync().getNetwork();
        Long lastSyncedBlock = syncStateTracker.getLastSyncedBlock(network).orElse(0L);
        Instant lastSync = syncStateTracker.getLastSyncTime(network).orElse(null);

        Long totalAddresses = null;
        Long totalTransfers = null;
        
        try {
            totalTransfers = graphRepository.countAllTransfers();
        } catch (Exception e) {
            log.warn("Failed to count transfers in Neo4j", e);
        }

        // Calculate next sync time
        Instant nextSync = null;
        if (lastSyncTime != null && graphProperties.getSync().isEnabled()) {
            nextSync = lastSyncTime.plusMillis(graphProperties.getSync().getInterval());
        }

        return SyncStatusResponse.builder()
                .status(syncRunning.get() ? "running" : "idle")
                .lastSyncedBlock(lastSyncedBlock)
                .totalAddresses(totalAddresses)
                .totalTransfers(totalTransfers)
                .lastSyncTime(lastSync)
                .nextSyncTime(nextSync)
                .network(network)
                .errorMessage(lastError)
                .build();
    }

    @Override
    public boolean isSyncRunning() {
        return syncRunning.get();
    }

    @Override
    public SyncStatusResponse triggerSync() {
        if (syncRunning.get()) {
            return SyncStatusResponse.builder()
                    .status("already_running")
                    .errorMessage("Sync is already in progress")
                    .build();
        }

        // Run sync in background
        new Thread(() -> {
            try {
                syncTransfers();
            } catch (Exception e) {
                log.error("Manual sync failed", e);
            }
        }).start();

        return SyncStatusResponse.builder()
                .status("started")
                .network(graphProperties.getSync().getNetwork())
                .build();
    }

    private TransferData toTransferData(TransferRecord record) {
        return new TransferData(
                record.fromAddress(),
                record.toAddress(),
                record.txHash(),
                record.value(),
                record.blockNumber(),
                record.timestamp(),
                record.tokenSymbol(),
                record.tokenAddress(),
                record.transferType(),
                record.network()
        );
    }
}
