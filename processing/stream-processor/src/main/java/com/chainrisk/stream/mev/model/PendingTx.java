package com.chainrisk.stream.mev.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.math.BigInteger;

/**
 * Pending transaction from mempool
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class PendingTx implements Serializable {
    private static final long serialVersionUID = 1L;

    private String hash;
    private String from;
    private String to;
    private String value;
    private long gas;

    @JsonProperty("gas_price")
    private String gasPrice;

    @JsonProperty("gas_fee_cap")
    private String gasFeeCap;

    @JsonProperty("gas_tip_cap")
    private String gasTipCap;

    private long nonce;
    private String input;

    @JsonProperty("method_id")
    private String methodId;

    @JsonProperty("token_target")
    private String tokenTarget;

    private long timestamp;
    private String network;

    @JsonProperty("tx_type")
    private int txType;

    // Getters and setters
    public String getHash() { return hash; }
    public void setHash(String hash) { this.hash = hash; }

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public String getTo() { return to; }
    public void setTo(String to) { this.to = to; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public long getGas() { return gas; }
    public void setGas(long gas) { this.gas = gas; }

    public String getGasPrice() { return gasPrice; }
    public void setGasPrice(String gasPrice) { this.gasPrice = gasPrice; }

    public String getGasFeeCap() { return gasFeeCap; }
    public void setGasFeeCap(String gasFeeCap) { this.gasFeeCap = gasFeeCap; }

    public String getGasTipCap() { return gasTipCap; }
    public void setGasTipCap(String gasTipCap) { this.gasTipCap = gasTipCap; }

    public long getNonce() { return nonce; }
    public void setNonce(long nonce) { this.nonce = nonce; }

    public String getInput() { return input; }
    public void setInput(String input) { this.input = input; }

    public String getMethodId() { return methodId; }
    public void setMethodId(String methodId) { this.methodId = methodId; }

    public String getTokenTarget() { return tokenTarget; }
    public void setTokenTarget(String tokenTarget) { this.tokenTarget = tokenTarget; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public String getNetwork() { return network; }
    public void setNetwork(String network) { this.network = network; }

    public int getTxType() { return txType; }
    public void setTxType(int txType) { this.txType = txType; }

    /**
     * Get effective gas price for comparison
     */
    public BigInteger getEffectiveGasPrice() {
        if (txType == 2 && gasFeeCap != null && !gasFeeCap.isEmpty()) {
            return new BigInteger(gasFeeCap);
        }
        return gasPrice != null ? new BigInteger(gasPrice) : BigInteger.ZERO;
    }

    /**
     * Check if this is a DEX swap transaction
     */
    public boolean isDexSwap() {
        if (methodId == null || methodId.length() < 10) {
            return false;
        }
        String method = methodId.substring(0, 10).toLowerCase();
        return method.equals("0x38ed1739") || // swapExactTokensForTokens
               method.equals("0x8803dbee") || // swapTokensForExactTokens
               method.equals("0x7ff36ab5") || // swapExactETHForTokens
               method.equals("0x4a25d94a") || // swapTokensForExactETH
               method.equals("0x18cbafe5") || // swapExactTokensForETH
               method.equals("0xfb3bdb41") || // swapETHForExactTokens
               method.equals("0x5ae401dc") || // multicall
               method.equals("0x414bf389") || // exactInputSingle (V3)
               method.equals("0xc04b8d59") || // exactInput
               method.equals("0xdb3e2198");   // exactOutputSingle
    }

    /**
     * Extract target token from swap input data (simplified)
     */
    public String extractTargetToken() {
        if (tokenTarget != null && !tokenTarget.isEmpty()) {
            return tokenTarget;
        }
        return to; // Use contract address as fallback
    }
}
