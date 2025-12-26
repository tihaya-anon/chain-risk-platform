package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.ChainEvent;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * Kafka deserializer for ChainEvent
 */
public class ChainEventDeserializer implements DeserializationSchema<ChainEvent> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(ChainEventDeserializer.class);

    private transient ObjectMapper objectMapper;

    @Override
    public ChainEvent deserialize(byte[] message) throws IOException {
        if (objectMapper == null) {
            initObjectMapper();
        }

        try {
            return objectMapper.readValue(message, ChainEvent.class);
        } catch (Exception e) {
            LOG.error("Failed to deserialize message: {}", new String(message), e);
            return null;
        }
    }

    @Override
    public boolean isEndOfStream(ChainEvent nextElement) {
        return false;
    }

    @Override
    public TypeInformation<ChainEvent> getProducedType() {
        return TypeInformation.of(ChainEvent.class);
    }

    private void initObjectMapper() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }
}
