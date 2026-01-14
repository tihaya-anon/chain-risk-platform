package com.chainrisk.stream.mev.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.List;

/**
 * MEV alert event
 */
public class MevAlert implements Serializable {
    private static final long serialVersionUID = 1L;

    public enum AlertType {
        SANDWICH_ATTACK,
        FRONT_RUN,
        ABNORMAL_GAS
    }

    @JsonProperty("alert_id")
    private String alertId;

    @JsonProperty("alert_type")
    private AlertType alertType;

    private String network;
    private long timestamp;

    @JsonProperty("attacker_address")
    private String attackerAddress;

    @JsonProperty("victim_address")
    private String victimAddress;

    @JsonProperty("victim_tx_hash")
    private String victimTxHash;

    @JsonProperty("front_tx_hash")
    private String frontTxHash;

    @JsonProperty("back_tx_hash")
    private String backTxHash;

    @JsonProperty("target_contract")
    private String targetContract;

    @JsonProperty("estimated_profit_wei")
    private String estimatedProfitWei;

    @JsonProperty("gas_price_diff")
    private String gasPriceDiff;

    @JsonProperty("severity")
    private String severity;

    @JsonProperty("related_txs")
    private List<String> relatedTxs;

    // Getters and setters
    public String getAlertId() { return alertId; }
    public void setAlertId(String alertId) { this.alertId = alertId; }

    public AlertType getAlertType() { return alertType; }
    public void setAlertType(AlertType alertType) { this.alertType = alertType; }

    public String getNetwork() { return network; }
    public void setNetwork(String network) { this.network = network; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public String getAttackerAddress() { return attackerAddress; }
    public void setAttackerAddress(String attackerAddress) { this.attackerAddress = attackerAddress; }

    public String getVictimAddress() { return victimAddress; }
    public void setVictimAddress(String victimAddress) { this.victimAddress = victimAddress; }

    public String getVictimTxHash() { return victimTxHash; }
    public void setVictimTxHash(String victimTxHash) { this.victimTxHash = victimTxHash; }

    public String getFrontTxHash() { return frontTxHash; }
    public void setFrontTxHash(String frontTxHash) { this.frontTxHash = frontTxHash; }

    public String getBackTxHash() { return backTxHash; }
    public void setBackTxHash(String backTxHash) { this.backTxHash = backTxHash; }

    public String getTargetContract() { return targetContract; }
    public void setTargetContract(String targetContract) { this.targetContract = targetContract; }

    public String getEstimatedProfitWei() { return estimatedProfitWei; }
    public void setEstimatedProfitWei(String estimatedProfitWei) { this.estimatedProfitWei = estimatedProfitWei; }

    public String getGasPriceDiff() { return gasPriceDiff; }
    public void setGasPriceDiff(String gasPriceDiff) { this.gasPriceDiff = gasPriceDiff; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public List<String> getRelatedTxs() { return relatedTxs; }
    public void setRelatedTxs(List<String> relatedTxs) { this.relatedTxs = relatedTxs; }
}
