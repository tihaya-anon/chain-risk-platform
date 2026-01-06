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

/**
 * Neo4j Node representing a cluster of related addresses
 * 
 * Addresses are clustered based on common input heuristics,
 * meaning addresses that appear as inputs in the same transaction
 * are likely controlled by the same entity.
 */
@Node("Cluster")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClusterNode {

    /**
     * Unique cluster identifier
     */
    @Id
    private String clusterId;

    /**
     * Number of addresses in this cluster
     */
    @Property("size")
    @Builder.Default
    private Integer size = 0;

    /**
     * Aggregated risk score for the cluster
     */
    @Property("riskScore")
    @Builder.Default
    private Double riskScore = 0.0;

    /**
     * Tags associated with this cluster
     */
    @Property("tags")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    /**
     * Label/name for this cluster (e.g., "Binance Hot Wallet")
     */
    @Property("label")
    private String label;

    /**
     * Category of the cluster (e.g., "exchange", "mixer", "defi")
     */
    @Property("category")
    private String category;

    /**
     * When this cluster was first identified
     */
    @Property("createdAt")
    private Instant createdAt;

    /**
     * When this cluster was last updated
     */
    @Property("updatedAt")
    private Instant updatedAt;

    /**
     * Network (ethereum, bsc, etc.)
     */
    @Property("network")
    @Builder.Default
    private String network = "ethereum";

    /**
     * Addresses belonging to this cluster
     */
    @Relationship(type = "CONTAINS", direction = Relationship.Direction.OUTGOING)
    @Builder.Default
    private Set<AddressNode> addresses = new HashSet<>();

    /**
     * Add a tag to this cluster
     */
    public void addTag(String tag) {
        if (tags == null) {
            tags = new ArrayList<>();
        }
        if (!tags.contains(tag)) {
            tags.add(tag);
        }
    }

    /**
     * Remove a tag from this cluster
     */
    public boolean removeTag(String tag) {
        return tags != null && tags.remove(tag);
    }

    /**
     * Update cluster size based on addresses set
     */
    public void updateSize() {
        this.size = addresses != null ? addresses.size() : 0;
    }

    /**
     * Calculate aggregated risk score from member addresses
     */
    public void calculateRiskScore() {
        if (addresses == null || addresses.isEmpty()) {
            this.riskScore = 0.0;
            return;
        }
        
        double totalScore = addresses.stream()
                .mapToDouble(a -> a.getRiskScore() != null ? a.getRiskScore() : 0.0)
                .sum();
        this.riskScore = totalScore / addresses.size();
    }

    /**
     * Aggregate tags from all member addresses
     */
    public void aggregateTags() {
        if (addresses == null || addresses.isEmpty()) {
            return;
        }
        
        Set<String> allTags = new HashSet<>();
        for (AddressNode address : addresses) {
            if (address.getTags() != null) {
                allTags.addAll(address.getTags());
            }
        }
        this.tags = new ArrayList<>(allTags);
    }
}
