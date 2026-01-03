package com.chainrisk.batch.model;

import java.io.Serializable;
import java.math.BigInteger;
import java.time.Instant;

/**
 * Transfer model for batch processing
 * Compatible with stream-processor Transfer model
 */
public class Transfer implements Serializable {
    private static final long serialVersionUID = 1L;

    private String txHash;
    private Long blockNumber;
    private Integer logIndex;
    private String fromAddress;
    private String toAddress;
    private BigInteger value;
    private String tokenAddress;
    private String tokenSymbol;
    private Integer tokenDecimal;
    private Instant timestamp;
    private String transferType; // "native", "erc20"
    private String network;

    // Default constructor
    public Transfer() {}

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
