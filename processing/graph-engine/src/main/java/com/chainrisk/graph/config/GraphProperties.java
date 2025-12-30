package com.chainrisk.graph.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Graph Engine Configuration Properties
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "graph")
public class GraphProperties {

    private SyncProperties sync = new SyncProperties();
    private ClusteringProperties clustering = new ClusteringProperties();
    private PropagationProperties propagation = new PropagationProperties();

    @Data
    public static class SyncProperties {
        /**
         * Enable/disable automatic sync
         */
        private boolean enabled = true;

        /**
         * Sync interval in milliseconds
         */
        private long interval = 300000; // 5 minutes

        /**
         * Batch size for syncing transfers
         */
        private int batchSize = 1000;

        /**
         * Network to sync (ethereum, bsc, etc.)
         */
        private String network = "ethereum";
    }

    @Data
    public static class ClusteringProperties {
        /**
         * Minimum cluster size to persist
         */
        private int minClusterSize = 2;

        /**
         * Maximum depth for common input analysis
         */
        private int maxDepth = 3;
    }

    @Data
    public static class PropagationProperties {
        /**
         * Maximum hops for tag propagation
         */
        private int maxHops = 5;

        /**
         * Decay factor per hop (0.0 - 1.0)
         */
        private double decayFactor = 0.7;

        /**
         * Minimum score threshold to continue propagation
         */
        private double minThreshold = 0.1;
    }
}
