package com.chainrisk.stream.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.math.BigInteger;
import java.time.Instant;

/**
 * Represents a token or native currency transfer
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Transfer implements Serializable {
    private static final long serialVersionUID = 1L;

    private String txHash;
    private Long blockNumber;
    private Integer logIndex;
    
    @JsonProperty("from")
    private String fromAddress;
    
    @JsonProperty("to")
    private String toAddress;
    
    private BigInteger value;
    private String tokenAddress;
    private String tokenSymbol;
    private Integer tokenDecimal;
    private Instant timestamp;
    private String transferType; // "native", "erc20", "erc721", "erc1155"
    private String network;

    // Default constructor
    public Transfer() {}

    // Builder-style constructor
    public static Transfer fromTransaction(Transaction tx, String network) {
        Transfer transfer = new Transfer();
        transfer.setTxHash(tx.getHash());
        transfer.setBlockNumber(tx.getBlockNumber());
        transfer.setLogIndex(0);
        transfer.setFromAddress(tx.getFromAddress());
        transfer.setToAddress(tx.getToAddress());
        transfer.setValue(tx.getValue());
        transfer.setTokenAddress(null); // Native transfer
        transfer.setTokenSymbol(getNetworkSymbol(network));
        transfer.setTokenDecimal(18);
        transfer.setTimestamp(tx.getTimestamp());
        transfer.setTransferType("native");
        transfer.setNetwork(network);
        return transfer;
    }

    private static String getNetworkSymbol(String network) {
        return switch (network.toLowerCase()) {
            case "ethereum" -> "ETH";
            case "bsc" -> "BNB";
            case "polygon" -> "MATIC";
            default -> "UNKNOWN";
        };
    }

    // Getters and Setters
    public String getTxHash() {
        return txHash;
    }

    public void setTxHash(String txHash) {
        this.txHash = txHash;
    }

    public Long getBlockNumber() {
        return blockNumber;
    }

    public void setBlockNumber(Long blockNumber) {
        this.blockNumber = blockNumber;
    }

    public Integer getLogIndex() {
        return logIndex;
    }

    public void setLogIndex(Integer logIndex) {
        this.logIndex = logIndex;
    }

    public String getFromAddress() {
        return fromAddress;
    }

    public void setFromAddress(String fromAddress) {
        this.fromAddress = fromAddress != null ? fromAddress.toLowerCase() : null;
    }

    public String getToAddress() {
        return toAddress;
    }

    public void setToAddress(String toAddress) {
        this.toAddress = toAddress != null ? toAddress.toLowerCase() : null;
    }

    public BigInteger getValue() {
        return value;
    }

    public void setValue(BigInteger value) {
        this.value = value;
    }

    public String getTokenAddress() {
        return tokenAddress;
    }

    public void setTokenAddress(String tokenAddress) {
        this.tokenAddress = tokenAddress != null ? tokenAddress.toLowerCase() : null;
    }

    public String getTokenSymbol() {
        return tokenSymbol;
    }

    public void setTokenSymbol(String tokenSymbol) {
        this.tokenSymbol = tokenSymbol;
    }

    public Integer getTokenDecimal() {
        return tokenDecimal;
    }

    public void setTokenDecimal(Integer tokenDecimal) {
        this.tokenDecimal = tokenDecimal;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getTransferType() {
        return transferType;
    }

    public void setTransferType(String transferType) {
        this.transferType = transferType;
    }

    public String getNetwork() {
        return network;
    }

    public void setNetwork(String network) {
        this.network = network;
    }

    /**
     * Check if this is a native token transfer (ETH, BNB, etc.)
     */
    public boolean isNativeTransfer() {
        return tokenAddress == null || tokenAddress.isEmpty();
    }

    /**
     * Get unique identifier for this transfer
     */
    public String getUniqueId() {
        return txHash + "-" + logIndex;
    }

    @Override
    public String toString() {
        return "Transfer{" +
                "txHash='" + txHash + '\'' +
                ", blockNumber=" + blockNumber +
                ", from='" + fromAddress + '\'' +
                ", to='" + toAddress + '\'' +
                ", value=" + value +
                ", token='" + tokenSymbol + '\'' +
                ", type='" + transferType + '\'' +
                '}';
    }
}
