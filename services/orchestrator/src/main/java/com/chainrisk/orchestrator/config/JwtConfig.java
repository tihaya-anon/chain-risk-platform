package com.chainrisk.orchestrator.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * JWT Configuration Properties
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtConfig {
    
    /**
     * JWT secret key for signing and validation
     */
    private String secret;
    
    /**
     * JWT expiration time in milliseconds
     */
    private Long expiration;
}
