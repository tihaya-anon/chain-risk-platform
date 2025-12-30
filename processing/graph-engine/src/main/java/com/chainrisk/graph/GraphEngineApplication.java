package com.chainrisk.graph;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
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
 */
@SpringBootApplication
@EnableScheduling
public class GraphEngineApplication {

    public static void main(String[] args) {
        SpringApplication.run(GraphEngineApplication.class, args);
    }
}
