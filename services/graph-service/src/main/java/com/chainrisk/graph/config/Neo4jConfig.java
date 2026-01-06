package com.chainrisk.graph.config;

import org.neo4j.driver.Driver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.neo4j.core.convert.Neo4jConversions;
import org.springframework.data.neo4j.core.transaction.Neo4jTransactionManager;
import org.springframework.data.neo4j.repository.config.EnableNeo4jRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import java.util.Arrays;

/**
 * Neo4j Configuration
 */
@Configuration
@EnableNeo4jRepositories(basePackages = "com.chainrisk.graph.repository")
@EnableTransactionManagement
public class Neo4jConfig {

    @Bean
    public Neo4jTransactionManager transactionManager(Driver driver) {
        return new Neo4jTransactionManager(driver);
    }

    /**
     * Register custom converters for Neo4j type mappings.
     * This handles conversion between Long (epoch milliseconds) and Instant.
     */
    @Bean
    public Neo4jConversions neo4jConversions() {
        return new Neo4jConversions(Arrays.asList(
            new Neo4jConverters.LongToInstantConverter(),
            new Neo4jConverters.InstantToLongConverter()
        ));
    }
}
