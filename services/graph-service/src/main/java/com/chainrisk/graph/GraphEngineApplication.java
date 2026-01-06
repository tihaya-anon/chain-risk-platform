package com.chainrisk.graph;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Graph Engine Application
 * 
 * Provides address clustering and tag propagation services using Neo4j.
 * 
 * Features:
 * - Sync transfers from PostgreSQL to Neo4j graph
 * - Address clustering based on common input heuristics
 * - Risk tag propagation through transaction graph
 * - REST API for graph queries
 * - Nacos service registration and dynamic configuration
 */
@SpringBootApplication
@EnableScheduling
@EnableDiscoveryClient
@ConfigurationPropertiesScan
public class GraphEngineApplication {

    public static void main(String[] args) {
        SpringApplication.run(GraphEngineApplication.class, args);
    }
}
