package com.chainrisk.stream.sink;

import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.api.java.tuple.Tuple2;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;

/**
 * Tracks processing state and periodically updates the database
 * with the last processed block number for each network.
 * 
 * Input: Tuple2<network, blockNumber>
 * Output: Long (blockNumber passthrough)
 */
public class ProcessingStateTracker extends KeyedProcessFunction<String, Tuple2<String, Long>, Long> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(ProcessingStateTracker.class);

    private static final long UPDATE_INTERVAL_MS = 30_000; // Update every 30 seconds

    private final String jdbcUrl;
    private final String username;
    private final String password;
    private final String processorType;

    private transient ValueState<Long> lastBlockState;
    private transient ValueState<Long> lastUpdateTimeState;
    private transient Connection connection;

    public ProcessingStateTracker(String jdbcUrl, String username, String password, String processorType) {
        this.jdbcUrl = jdbcUrl;
        this.username = username;
        this.password = password;
        this.processorType = processorType;
    }

    @Override
    public void open(Configuration parameters) throws Exception {
        // Initialize state
        lastBlockState = getRuntimeContext().getState(
                new ValueStateDescriptor<>("lastBlock", Long.class));
        lastUpdateTimeState = getRuntimeContext().getState(
                new ValueStateDescriptor<>("lastUpdateTime", Long.class));

        // Initialize database connection
        initConnection();
    }

    private void initConnection() throws Exception {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(jdbcUrl, username, password);
            LOG.info("Database connection established for processing state tracker");
        }
    }

    @Override
    public void processElement(Tuple2<String, Long> value, Context ctx, Collector<Long> out) throws Exception {
        String network = value.f0;
        Long blockNumber = value.f1;

        if (blockNumber == null) {
            return;
        }

        // Update last block state
        Long currentLastBlock = lastBlockState.value();
        if (currentLastBlock == null || blockNumber > currentLastBlock) {
            lastBlockState.update(blockNumber);
        }

        // Check if we should update the database
        Long lastUpdateTime = lastUpdateTimeState.value();
        long currentTime = System.currentTimeMillis();

        if (lastUpdateTime == null || (currentTime - lastUpdateTime) >= UPDATE_INTERVAL_MS) {
            updateProcessingState(network, lastBlockState.value());
            lastUpdateTimeState.update(currentTime);
        }

        // Pass through the block number
        out.collect(blockNumber);
    }

    private void updateProcessingState(String network, Long blockNumber) {
        if (blockNumber == null) {
            return;
        }

        String sql = """
                INSERT INTO chain_data.processing_state (id, last_processed_block, network, processor_type, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    last_processed_block = EXCLUDED.last_processed_block,
                    updated_at = EXCLUDED.updated_at
                """;

        String stateId = processorType + "-" + network;

        try {
            initConnection();
            try (PreparedStatement stmt = connection.prepareStatement(sql)) {
                stmt.setString(1, stateId);
                stmt.setLong(2, blockNumber);
                stmt.setString(3, network);
                stmt.setString(4, processorType);
                stmt.setTimestamp(5, Timestamp.from(Instant.now()));
                stmt.executeUpdate();
                LOG.debug("Updated processing state: {} -> block {}", stateId, blockNumber);
            }
        } catch (Exception e) {
            LOG.error("Failed to update processing state for {}: {}", stateId, e.getMessage());
            // Try to reconnect on next update
            try {
                if (connection != null) {
                    connection.close();
                }
            } catch (Exception ignored) {
            }
            connection = null;
        }
    }

    @Override
    public void close() throws Exception {
        if (connection != null && !connection.isClosed()) {
            connection.close();
            LOG.info("Database connection closed for processing state tracker");
        }
    }
}
