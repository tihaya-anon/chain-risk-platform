package com.chainrisk.stream.mev;

import com.chainrisk.stream.mev.model.PendingTx;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;

import java.io.IOException;

/**
 * Kafka deserializer for PendingTx
 */
public class PendingTxDeserializer implements DeserializationSchema<PendingTx> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public PendingTx deserialize(byte[] bytes) throws IOException {
        if (bytes == null || bytes.length == 0) {
            return null;
        }
        return MAPPER.readValue(bytes, PendingTx.class);
    }

    @Override
    public boolean isEndOfStream(PendingTx tx) {
        return false;
    }

    @Override
    public TypeInformation<PendingTx> getProducedType() {
        return TypeInformation.of(PendingTx.class);
    }
}
