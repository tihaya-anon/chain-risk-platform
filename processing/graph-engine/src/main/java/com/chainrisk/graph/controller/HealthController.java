package com.chainrisk.graph.controller;

import lombok.RequiredArgsConstructor;
import org.neo4j.driver.Driver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Health check endpoint for the Graph Engine service
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final Driver neo4jDriver;
    private final JdbcTemplate jdbcTemplate;

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now());
        health.put("service", "graph-engine");

        // Check Neo4j
        Map<String, Object> neo4j = new HashMap<>();
        try {
            neo4jDriver.verifyConnectivity();
            neo4j.put("status", "UP");
        } catch (Exception e) {
            neo4j.put("status", "DOWN");
            neo4j.put("error", e.getMessage());
            health.put("status", "DEGRADED");
        }
        health.put("neo4j", neo4j);

        // Check PostgreSQL
        Map<String, Object> postgres = new HashMap<>();
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            postgres.put("status", "UP");
        } catch (Exception e) {
            postgres.put("status", "DOWN");
            postgres.put("error", e.getMessage());
            health.put("status", "DEGRADED");
        }
        health.put("postgres", postgres);

        return health;
    }

    @GetMapping("/ready")
    public Map<String, Object> ready() {
        Map<String, Object> ready = new HashMap<>();
        ready.put("ready", true);
        ready.put("timestamp", Instant.now());
        return ready;
    }

    @GetMapping("/live")
    public Map<String, Object> live() {
        Map<String, Object> live = new HashMap<>();
        live.put("alive", true);
        live.put("timestamp", Instant.now());
        return live;
    }
}
