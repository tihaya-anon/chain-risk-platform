package com.chainrisk.stream.mev;

import com.chainrisk.stream.mev.model.MevAlert;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.SerializationSchema;

/**
 * Kafka serializer for MevAlert
 */
public class MevAlertSerializer implements SerializationSchema<MevAlert> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public byte[] serialize(MevAlert alert) {
        try {
            return MAPPER.writeValueAsBytes(alert);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize MevAlert", e);
        }
    }
}
