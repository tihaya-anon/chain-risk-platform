package com.chainrisk.graph.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

/**
 * Pipeline configuration properties loaded from Nacos.
 * Supports dynamic refresh via @RefreshScope.
 */
@Data
@Component
@RefreshScope
@ConfigurationProperties(prefix = "pipeline")
public class PipelineProperties {

    /**
     * Master switch for the entire pipeline
     */
    private boolean enabled = true;

    /**
     * Clustering configuration
     */
    private ClusteringConfig clustering = new ClusteringConfig();

    /**
     * Tag propagation configuration
     */
    private PropagationConfig propagation = new PropagationConfig();

    @Data
    public static class ClusteringConfig {
        private boolean enabled = true;
        private int minClusterSize = 2;
        private int maxDepth = 3;
    }

    @Data
    public static class PropagationConfig {
        private boolean enabled = true;
        private int maxHops = 5;
        private double decayFactor = 0.7;
        private double minThreshold = 0.1;
    }
}
