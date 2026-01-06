package com.chainrisk.graph.model.relationship;

import com.chainrisk.graph.model.node.AddressNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Property;
import org.springframework.data.neo4j.core.schema.RelationshipProperties;
import org.springframework.data.neo4j.core.schema.TargetNode;

import java.math.BigInteger;
import java.time.Instant;

/**
 * Neo4j Relationship representing a transfer between two addresses
 */
@RelationshipProperties
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransferRelationship {

    @Id
    @GeneratedValue
    private Long id;

    /**
     * Target address (recipient)
     */
    @TargetNode
    private AddressNode targetAddress;

    /**
     * Transaction hash
     */
    @Property("txHash")
    private String txHash;

    /**
     * Transfer value in wei (stored as string for BigInteger support)
     */
    @Property("value")
    private String value;

    /**
     * Block number
     */
    @Property("blockNumber")
    private Long blockNumber;

    /**
     * Timestamp of the transfer
     */
    @Property("timestamp")
    private Instant timestamp;

    /**
     * Token symbol (ETH, USDT, etc.)
     */
    @Property("tokenSymbol")
    private String tokenSymbol;

    /**
     * Token contract address (null for native transfers)
     */
    @Property("tokenAddress")
    private String tokenAddress;

    /**
     * Transfer type (native, erc20, erc721, erc1155)
     */
    @Property("transferType")
    @Builder.Default
    private String transferType = "native";

    /**
     * Network (ethereum, bsc, etc.)
     */
    @Property("network")
    @Builder.Default
    private String network = "ethereum";

    /**
     * Get value as BigInteger
     */
    public BigInteger getValueAsBigInteger() {
        if (value == null || value.isEmpty()) {
            return BigInteger.ZERO;
        }
        try {
            return new BigInteger(value);
        } catch (NumberFormatException e) {
            return BigInteger.ZERO;
        }
    }

    /**
     * Set value from BigInteger
     */
    public void setValueFromBigInteger(BigInteger bigIntValue) {
        this.value = bigIntValue != null ? bigIntValue.toString() : "0";
    }

    /**
     * Get unique identifier for this transfer
     */
    public String getUniqueId() {
        return txHash + "-" + (blockNumber != null ? blockNumber : 0);
    }
}
