package com.chainrisk.stream.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.Serializable;

/**
 * Represents raw block data received from Kafka
 * This is the new format from data-ingestion service that sends raw block JSON
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class RawBlockData implements Serializable {
    private static final long serialVersionUID = 1L;

    private String network;      // "ethereum", "bsc"
    private Long blockNumber;
    private Long timestamp;      // Unix timestamp (seconds)
    private JsonNode rawBlock;   // Raw block JSON from Etherscan API

    public RawBlockData() {}

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

    public Long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }

    public JsonNode getRawBlock() {
        return rawBlock;
    }

    public void setRawBlock(JsonNode rawBlock) {
        this.rawBlock = rawBlock;
    }

    /**
     * Get the result node from the raw block (Etherscan API format)
     * @return The result JsonNode or null if not present
     */
    public JsonNode getResult() {
        if (rawBlock == null) {
            return null;
        }
        return rawBlock.get("result");
    }

    /**
     * Check if this is a valid block response
     * @return true if the block has valid result data
     */
    public boolean isValid() {
        JsonNode result = getResult();
        return result != null && !result.isNull() && result.has("transactions");
    }

    @Override
    public String toString() {
        return "RawBlockData{" +
                "network='" + network + '\'' +
                ", blockNumber=" + blockNumber +
                ", timestamp=" + timestamp +
                ", hasRawBlock=" + (rawBlock != null) +
                '}';
    }
}
