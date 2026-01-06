package com.chainrisk.graph.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Graph Service Configuration Properties
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "graph")
public class GraphProperties {

    private ClusteringProperties clustering = new ClusteringProperties();
    private PropagationProperties propagation = new PropagationProperties();

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
