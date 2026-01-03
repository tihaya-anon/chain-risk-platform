package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.RawBlockData;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * Deserializer for RawBlockData from Kafka
 * Handles the new format where data-ingestion sends raw block JSON
 */
public class RawBlockDataDeserializer implements DeserializationSchema<RawBlockData> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(RawBlockDataDeserializer.class);

    private transient ObjectMapper objectMapper;

    @Override
    public RawBlockData deserialize(byte[] message) throws IOException {
        if (objectMapper == null) {
            initObjectMapper();
        }

        try {
            RawBlockData data = objectMapper.readValue(message, RawBlockData.class);
            LOG.debug("Deserialized raw block data: network={}, block={}", 
                    data.getNetwork(), data.getBlockNumber());
            return data;
        } catch (Exception e) {
            LOG.error("Failed to deserialize message: {}", new String(message), e);
            return null;
        }
    }

    @Override
    public boolean isEndOfStream(RawBlockData nextElement) {
        return false;
    }

    @Override
    public TypeInformation<RawBlockData> getProducedType() {
        return TypeInformation.of(RawBlockData.class);
    }

    private void initObjectMapper() {
        objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }
}
