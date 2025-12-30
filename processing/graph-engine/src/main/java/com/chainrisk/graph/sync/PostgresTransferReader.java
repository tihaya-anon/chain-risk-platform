package com.chainrisk.graph.sync;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;

/**
 * Reads transfer data from PostgreSQL for syncing to Neo4j
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresTransferReader {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Read transfers from PostgreSQL starting from a specific block
     */
    public List<TransferRecord> readTransfers(Long fromBlock, int limit, String network) {
        String sql = """
            SELECT 
                tx_hash,
                block_number,
                from_address,
                to_address,
                value::text as value,
                timestamp,
                token_address,
                token_symbol,
                transfer_type,
                network
            FROM chain_data.transfers
            WHERE block_number > ?
              AND network = ?
            ORDER BY block_number ASC, id ASC
            LIMIT ?
            """;

        log.debug("Reading transfers from block {} for network {}, limit {}", fromBlock, network, limit);
        
        return jdbcTemplate.query(sql, new TransferRowMapper(), fromBlock, network, limit);
    }

    /**
     * Read transfers within a block range
     */
    public List<TransferRecord> readTransfersInRange(Long fromBlock, Long toBlock, String network) {
        String sql = """
            SELECT 
                tx_hash,
                block_number,
                from_address,
                to_address,
                value::text as value,
                timestamp,
                token_address,
                token_symbol,
                transfer_type,
                network
            FROM chain_data.transfers
            WHERE block_number > ? AND block_number <= ?
              AND network = ?
            ORDER BY block_number ASC, id ASC
            """;

        log.debug("Reading transfers from block {} to {} for network {}", fromBlock, toBlock, network);
        
        return jdbcTemplate.query(sql, new TransferRowMapper(), fromBlock, toBlock, network);
    }

    /**
     * Get the latest block number in PostgreSQL
     */
    public Long getLatestBlockNumber(String network) {
        String sql = "SELECT MAX(block_number) FROM chain_data.transfers WHERE network = ?";
        return jdbcTemplate.queryForObject(sql, Long.class, network);
    }

    /**
     * Get total transfer count
     */
    public Long getTotalTransferCount(String network) {
        String sql = "SELECT COUNT(*) FROM chain_data.transfers WHERE network = ?";
        return jdbcTemplate.queryForObject(sql, Long.class, network);
    }

    /**
     * Get transfer count after a specific block
     */
    public Long getTransferCountAfterBlock(Long blockNumber, String network) {
        String sql = "SELECT COUNT(*) FROM chain_data.transfers WHERE block_number > ? AND network = ?";
        return jdbcTemplate.queryForObject(sql, Long.class, blockNumber, network);
    }

    /**
     * Transfer record from PostgreSQL
     */
    public record TransferRecord(
            String txHash,
            Long blockNumber,
            String fromAddress,
            String toAddress,
            String value,
            Instant timestamp,
            String tokenAddress,
            String tokenSymbol,
            String transferType,
            String network
    ) {}

    /**
     * Row mapper for transfer records
     */
    private static class TransferRowMapper implements RowMapper<TransferRecord> {
        @Override
        public TransferRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new TransferRecord(
                    rs.getString("tx_hash"),
                    rs.getLong("block_number"),
                    rs.getString("from_address"),
                    rs.getString("to_address"),
                    rs.getString("value"),
                    rs.getTimestamp("timestamp").toInstant(),
                    rs.getString("token_address"),
                    rs.getString("token_symbol"),
                    rs.getString("transfer_type"),
                    rs.getString("network")
            );
        }
    }
}
