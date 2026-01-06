package com.chainrisk.graph.model.node;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Property;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.chainrisk.graph.model.relationship.TransferRelationship;

/**
 * Neo4j Node representing a blockchain address
 */
@Node("Address")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressNode {

    /**
     * The blockchain address (lowercase, 0x-prefixed)
     */
    @Id
    private String address;

    /**
     * First time this address was seen in a transaction
     */
    @Property("firstSeen")
    private Instant firstSeen;

    /**
     * Last time this address was seen in a transaction
     */
    @Property("lastSeen")
    private Instant lastSeen;

    /**
     * Total number of transactions involving this address
     */
    @Property("txCount")
    @Builder.Default
    private Long txCount = 0L;

    /**
     * Risk score (0.0 - 1.0)
     */
    @Property("riskScore")
    @Builder.Default
    private Double riskScore = 0.0;

    /**
     * Tags associated with this address (e.g., "exchange", "mixer", "scam")
     */
    @Property("tags")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    /**
     * Concatenated tags string for full-text search
     */
    @Property("tagsString")
    private String tagsString;

    /**
     * Cluster ID this address belongs to (if any)
     */
    @Property("clusterId")
    private String clusterId;

    /**
     * Network (ethereum, bsc, etc.)
     */
    @Property("network")
    @Builder.Default
    private String network = "ethereum";

    /**
     * Outgoing transfers from this address
     */
    @Relationship(type = "TRANSFER", direction = Relationship.Direction.OUTGOING)
    @Builder.Default
    private Set<TransferRelationship> outgoingTransfers = new HashSet<>();

    /**
     * Add a tag to this address
     */
    public void addTag(String tag) {
        if (tags == null) {
            tags = new ArrayList<>();
        }
        if (!tags.contains(tag)) {
            tags.add(tag);
            updateTagsString();
        }
    }

    /**
     * Remove a tag from this address
     */
    public boolean removeTag(String tag) {
        if (tags != null && tags.remove(tag)) {
            updateTagsString();
            return true;
        }
        return false;
    }

    /**
     * Check if address has a specific tag
     */
    public boolean hasTag(String tag) {
        return tags != null && tags.contains(tag);
    }

    /**
     * Update the concatenated tags string for full-text search
     */
    private void updateTagsString() {
        this.tagsString = tags != null ? String.join(" ", tags) : "";
    }

    /**
     * Increment transaction count
     */
    public void incrementTxCount() {
        this.txCount = (this.txCount == null ? 0 : this.txCount) + 1;
    }

    /**
     * Update timestamps based on a new transaction
     */
    public void updateTimestamps(Instant timestamp) {
        if (this.firstSeen == null || timestamp.isBefore(this.firstSeen)) {
            this.firstSeen = timestamp;
        }
        if (this.lastSeen == null || timestamp.isAfter(this.lastSeen)) {
            this.lastSeen = timestamp;
        }
    }
}
