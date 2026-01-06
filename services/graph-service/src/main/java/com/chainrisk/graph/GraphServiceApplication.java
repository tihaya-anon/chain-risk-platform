package com.chainrisk.graph;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Graph Service Application
 * 
 * Provides address clustering and tag propagation services using Neo4j.
 * Data is written by Flink stream processor (dual-write to PostgreSQL + Neo4j).
 * 
 * Features:
 * - Address clustering based on common input heuristics
 * - Risk tag propagation through transaction graph
 * - REST API for graph queries
 * - Nacos service registration and dynamic configuration
 */
@SpringBootApplication
@EnableScheduling
@EnableDiscoveryClient
@ConfigurationPropertiesScan
public class GraphServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(GraphServiceApplication.class, args);
    }
}
