package com.chainrisk.graph.sync;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

/**
 * Tracks sync state between PostgreSQL and Neo4j
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SyncStateTracker {

    private static final String SYNC_STATE_ID = "graph-engine-sync";
    
    private final JdbcTemplate jdbcTemplate;

    /**
     * Get the last synced block number
     */
    public Optional<Long> getLastSyncedBlock(String network) {
        String sql = """
            SELECT last_processed_block 
            FROM chain_data.processing_state 
            WHERE id = ? AND network = ?
            """;
        
        try {
            Long block = jdbcTemplate.queryForObject(sql, Long.class, SYNC_STATE_ID, network);
            return Optional.ofNullable(block);
        } catch (Exception e) {
            log.debug("No sync state found for network {}", network);
            return Optional.empty();
        }
    }

    /**
     * Update the last synced block number
     */
    public void updateLastSyncedBlock(Long blockNumber, String network) {
        String sql = """
            INSERT INTO chain_data.processing_state (id, last_processed_block, network, processor_type, updated_at)
            VALUES (?, ?, ?, 'graph-engine', ?)
            ON CONFLICT (id) 
            DO UPDATE SET last_processed_block = ?, updated_at = ?
            """;
        
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(sql, SYNC_STATE_ID, blockNumber, network, now, blockNumber, now);
        log.debug("Updated sync state: block {} for network {}", blockNumber, network);
    }

    /**
     * Get the last sync timestamp
     */
    public Optional<Instant> getLastSyncTime(String network) {
        String sql = """
            SELECT updated_at 
            FROM chain_data.processing_state 
            WHERE id = ? AND network = ?
            """;
        
        try {
            Timestamp timestamp = jdbcTemplate.queryForObject(sql, Timestamp.class, SYNC_STATE_ID, network);
            return Optional.ofNullable(timestamp).map(Timestamp::toInstant);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Reset sync state (use with caution)
     */
    public void resetSyncState(String network) {
        String sql = "DELETE FROM chain_data.processing_state WHERE id = ? AND network = ?";
        jdbcTemplate.update(sql, SYNC_STATE_ID, network);
        log.info("Reset sync state for network {}", network);
    }
}
