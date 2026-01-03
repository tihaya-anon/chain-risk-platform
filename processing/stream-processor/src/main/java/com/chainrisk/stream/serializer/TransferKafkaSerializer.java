package com.chainrisk.stream.serializer;

import com.chainrisk.stream.model.Transfer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.serialization.SerializationSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Kafka serializer for Transfer objects
 * 
 * Converts Transfer to JSON for Kafka transfers topic
 * Used by Speed Layer to notify downstream consumers (Graph Engine)
 */
public class TransferKafkaSerializer implements SerializationSchema<Transfer> {
    private static final Logger LOG = LoggerFactory.getLogger(TransferKafkaSerializer.class);
    
    private transient ObjectMapper objectMapper;

    @Override
    public void open(InitializationContext context) throws Exception {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public byte[] serialize(Transfer transfer) {
        try {
            return objectMapper.writeValueAsBytes(transfer);
        } catch (Exception e) {
            LOG.error("Failed to serialize transfer {}: {}", 
                    transfer.getTxHash(), e.getMessage());
            return null;
        }
    }
}
