package com.chainrisk.graph.config;

import io.micrometer.core.instrument.*;
import io.micrometer.core.instrument.binder.jvm.ExecutorServiceMetrics;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Metrics configuration implementing USE Method (Utilization, Saturation, Errors).
 */
@Configuration
public class MetricsConfig {

    private final MeterRegistry registry;
    private final AtomicInteger activeRequests = new AtomicInteger(0);
    private final AtomicInteger neo4jConnectionsUsed = new AtomicInteger(0);
    private final AtomicInteger neo4jConnectionsTotal = new AtomicInteger(100);

    public MetricsConfig(MeterRegistry registry) {
        this.registry = registry;
    }

    @PostConstruct
    public void init() {
        registerUseMetrics();
        startMetricsCollector();
    }

    private void registerUseMetrics() {
        // ============== USE: Utilization ==============
        Gauge.builder("graph_service_cpu_utilization_ratio", this::getCpuUtilization)
                .description("CPU utilization ratio (0-1)")
                .register(registry);

        Gauge.builder("graph_service_memory_utilization_ratio", this::getMemoryUtilization)
                .description("Memory utilization ratio (0-1)")
                .register(registry);

        Gauge.builder("graph_service_active_requests", activeRequests, AtomicInteger::get)
                .description("Number of currently processing requests")
                .register(registry);

        Gauge.builder("graph_service_thread_pool_active", this::getActiveThreadCount)
                .description("Number of active threads")
                .register(registry);

        Gauge.builder("graph_service_neo4j_connection_pool_utilization", this::getNeo4jPoolUtilization)
                .description("Neo4j connection pool utilization")
                .register(registry);

        Gauge.builder("graph_service_neo4j_connection_pool_used", neo4jConnectionsUsed, AtomicInteger::get)
                .description("Neo4j connections in use")
                .register(registry);

        Gauge.builder("graph_service_neo4j_connection_pool_total", neo4jConnectionsTotal, AtomicInteger::get)
                .description("Total Neo4j connection pool size")
                .register(registry);

        // ============== USE: Saturation ==============
        Counter.builder("graph_service_neo4j_connection_wait_total")
                .description("Requests that waited for Neo4j connection")
                .register(registry);

        Counter.builder("graph_service_rate_limit_exceeded_total")
                .description("Requests rejected by rate limiter")
                .register(registry);

        Counter.builder("graph_service_thread_pool_rejected_total")
                .description("Tasks rejected due to pool exhaustion")
                .register(registry);

        Gauge.builder("graph_service_request_queue_length", () -> 0)
                .description("Requests waiting in queue")
                .register(registry);

        // ============== USE: Errors ==============
        Counter.builder("graph_service_errors_total")
                .description("Total errors by type")
                .tag("type", "neo4j_error")
                .register(registry);

        Counter.builder("graph_service_errors_total")
                .tag("type", "timeout")
                .register(registry);

        Counter.builder("graph_service_errors_total")
                .tag("type", "validation")
                .register(registry);

        Gauge.builder("graph_service_circuit_breaker_state", () -> 0)
                .description("Circuit breaker state (0=closed, 1=half-open, 2=open)")
                .tag("target", "neo4j")
                .register(registry);
    }

    // ============== Business Metrics Beans ==============

    @Bean
    public Counter clusteringOperationsCounter() {
        return Counter.builder("graph_service_clustering_operations_total")
                .description("Total clustering operations")
                .tag("type", "common_input")
                .register(registry);
    }

    @Bean
    public Counter tagPropagationsCounter() {
        return Counter.builder("graph_service_tag_propagations_total")
                .description("Total tag propagation operations")
                .register(registry);
    }

    @Bean
    public Counter addressQueriesCounter() {
        return Counter.builder("graph_service_address_queries_total")
                .description("Total address queries")
                .register(registry);
    }

    @Bean
    public Counter clusterQueriesCounter() {
        return Counter.builder("graph_service_cluster_queries_total")
                .description("Total cluster queries")
                .register(registry);
    }

    @Bean
    public Counter pathQueriesCounter() {
        return Counter.builder("graph_service_path_queries_total")
                .description("Total path queries")
                .register(registry);
    }

    @Bean
    public Timer clusteringTimer() {
        return Timer.builder("graph_service_clustering_duration_seconds")
                .description("Clustering operation duration")
                .register(registry);
    }

    @Bean
    public Timer tagPropagationTimer() {
        return Timer.builder("graph_service_tag_propagation_duration_seconds")
                .description("Tag propagation duration")
                .register(registry);
    }

    @Bean
    public Timer neo4jQueryTimer() {
        return Timer.builder("graph_service_neo4j_query_duration_seconds")
                .description("Neo4j query duration")
                .register(registry);
    }

    // ============== Active Request Tracking ==============

    public void incrementActiveRequests() {
        activeRequests.incrementAndGet();
    }

    public void decrementActiveRequests() {
        activeRequests.decrementAndGet();
    }

    public void updateNeo4jPoolStats(int used, int total) {
        neo4jConnectionsUsed.set(used);
        neo4jConnectionsTotal.set(total);
    }

    // ============== Metric Helpers ==============

    private double getCpuUtilization() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        double load = osBean.getSystemLoadAverage();
        int processors = Runtime.getRuntime().availableProcessors();
        return load > 0 ? Math.min(load / processors, 1.0) : 0.0;
    }

    private double getMemoryUtilization() {
        MemoryMXBean memBean = ManagementFactory.getMemoryMXBean();
        long used = memBean.getHeapMemoryUsage().getUsed();
        long max = memBean.getHeapMemoryUsage().getMax();
        return max > 0 ? (double) used / max : 0.0;
    }

    private int getActiveThreadCount() {
        return Thread.activeCount();
    }

    private double getNeo4jPoolUtilization() {
        int total = neo4jConnectionsTotal.get();
        return total > 0 ? (double) neo4jConnectionsUsed.get() / total : 0.0;
    }

    private void startMetricsCollector() {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "metrics-collector");
            t.setDaemon(true);
            return t;
        });
        
        // Collect JVM metrics every 10 seconds
        scheduler.scheduleAtFixedRate(() -> {
            // Metrics are collected via gauges, this is placeholder for future collectors
        }, 10, 10, TimeUnit.SECONDS);
    }
}
