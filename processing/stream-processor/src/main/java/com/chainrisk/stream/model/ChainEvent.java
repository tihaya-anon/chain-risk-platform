package com.chainrisk.stream.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.Serializable;
import java.time.Instant;

/**
 * Represents a chain event received from Kafka
 * This is the wrapper format from data-ingestion service
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChainEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    private String eventType;  // "transaction", "transfer", "internal_tx"
    private String network;    // "ethereum", "bsc"
    private Long blockNumber;
    private Instant timestamp;
    private JsonNode data;     // The actual event data

    public ChainEvent() {}

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getNetwork() {
        return network;
    }

    public void setNetwork(String network) {
        this.network = network;
    }

    public Long getBlockNumber() {
        return blockNumber;
    }

    public void setBlockNumber(Long blockNumber) {
        this.blockNumber = blockNumber;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public JsonNode getData() {
        return data;
    }

    public void setData(JsonNode data) {
        this.data = data;
    }

    public boolean isTransaction() {
        return "transaction".equals(eventType);
    }

    public boolean isTransfer() {
        return "transfer".equals(eventType);
    }

    public boolean isInternalTransaction() {
        return "internal_tx".equals(eventType);
    }

    @Override
    public String toString() {
        return "ChainEvent{" +
                "eventType='" + eventType + '\'' +
                ", network='" + network + '\'' +
                ", blockNumber=" + blockNumber +
                ", timestamp=" + timestamp +
                '}';
    }
}
