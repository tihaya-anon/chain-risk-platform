package com.chainrisk.orchestrator.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

/**
 * Risk configuration properties loaded from Nacos.
 */
@Data
@Component
@RefreshScope
@ConfigurationProperties(prefix = "risk")
public class RiskProperties {

    /**
     * High risk threshold (0.0 - 1.0)
     */
    private double highThreshold = 0.7;

    /**
     * Medium risk threshold (0.0 - 1.0)
     */
    private double mediumThreshold = 0.4;

    /**
     * Cache TTL in seconds
     */
    private int cacheTtlSeconds = 300;
}
