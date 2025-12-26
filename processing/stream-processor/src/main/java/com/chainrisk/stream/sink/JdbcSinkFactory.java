package com.chainrisk.stream.sink;

import com.chainrisk.stream.model.Transfer;
import org.apache.flink.connector.jdbc.JdbcConnectionOptions;
import org.apache.flink.connector.jdbc.JdbcExecutionOptions;
import org.apache.flink.connector.jdbc.JdbcSink;
import org.apache.flink.streaming.api.functions.sink.SinkFunction;

import java.sql.Timestamp;
import java.time.Instant;

/**
 * Factory for creating JDBC sinks
 */
public class JdbcSinkFactory {

    private final String jdbcUrl;
    private final String username;
    private final String password;

    public JdbcSinkFactory(String jdbcUrl, String username, String password) {
        this.jdbcUrl = jdbcUrl;
        this.username = username;
        this.password = password;
    }

    /**
     * Create a sink for Transfer records
     */
    public SinkFunction<Transfer> createTransferSink() {
        String sql = """
                INSERT INTO chain_data.transfers
                (tx_hash, block_number, log_index, from_address, to_address, value,
                 token_address, token_symbol, token_decimal, timestamp, transfer_type, network)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (tx_hash, log_index) DO UPDATE SET
                    from_address = EXCLUDED.from_address,
                    to_address = EXCLUDED.to_address,
                    value = EXCLUDED.value,
                    timestamp = EXCLUDED.timestamp
                """;

        return JdbcSink.sink(
                sql,
                (statement, transfer) -> {
                    statement.setString(1, transfer.getTxHash());
                    statement.setLong(2, transfer.getBlockNumber() != null ? transfer.getBlockNumber() : 0L);
                    statement.setInt(3, transfer.getLogIndex() != null ? transfer.getLogIndex() : 0);
                    statement.setString(4, transfer.getFromAddress());
                    statement.setString(5, transfer.getToAddress());
                    statement.setBigDecimal(6, transfer.getValue() != null
                            ? new java.math.BigDecimal(transfer.getValue())
                            : java.math.BigDecimal.ZERO);
                    statement.setString(7, transfer.getTokenAddress());
                    statement.setString(8, transfer.getTokenSymbol());
                    statement.setObject(9, transfer.getTokenDecimal());
                    // Handle null timestamp - use current time as fallback
                    Instant ts = transfer.getTimestamp() != null ? transfer.getTimestamp() : Instant.now();
                    statement.setTimestamp(10, Timestamp.from(ts));
                    statement.setString(11, transfer.getTransferType());
                    statement.setString(12, transfer.getNetwork());
                },
                JdbcExecutionOptions.builder()
                        .withBatchSize(1000)
                        .withBatchIntervalMs(200)
                        .withMaxRetries(3)
                        .build(),
                new JdbcConnectionOptions.JdbcConnectionOptionsBuilder()
                        .withUrl(jdbcUrl)
                        .withDriverName("org.postgresql.Driver")
                        .withUsername(username)
                        .withPassword(password)
                        .build());
    }

    /**
     * Create connection options for reuse
     */
    public JdbcConnectionOptions getConnectionOptions() {
        return new JdbcConnectionOptions.JdbcConnectionOptionsBuilder()
                .withUrl(jdbcUrl)
                .withDriverName("org.postgresql.Driver")
                .withUsername(username)
                .withPassword(password)
                .build();
    }

    /**
     * Create execution options with custom settings
     */
    public JdbcExecutionOptions getExecutionOptions(int batchSize, long batchIntervalMs) {
        return JdbcExecutionOptions.builder()
                .withBatchSize(batchSize)
                .withBatchIntervalMs(batchIntervalMs)
                .withMaxRetries(3)
                .build();
    }
}
