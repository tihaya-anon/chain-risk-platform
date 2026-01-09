package com.chainrisk.graph.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Custom metrics configuration for Graph Service.
 */
@Configuration
public class MetricsConfig {

    @Bean
    public Counter clusteringOperationsCounter(MeterRegistry registry) {
        return Counter.builder("graph_service_clustering_operations_total")
                .description("Total clustering operations")
                .tag("type", "common_input")
                .register(registry);
    }

    @Bean
    public Counter tagPropagationsCounter(MeterRegistry registry) {
        return Counter.builder("graph_service_tag_propagations_total")
                .description("Total tag propagation operations")
                .register(registry);
    }

    @Bean
    public Counter addressQueriesCounter(MeterRegistry registry) {
        return Counter.builder("graph_service_address_queries_total")
                .description("Total address queries")
                .register(registry);
    }

    @Bean
    public Counter clusterQueriesCounter(MeterRegistry registry) {
        return Counter.builder("graph_service_cluster_queries_total")
                .description("Total cluster queries")
                .register(registry);
    }

    @Bean
    public Counter pathQueriesCounter(MeterRegistry registry) {
        return Counter.builder("graph_service_path_queries_total")
                .description("Total path queries")
                .register(registry);
    }

    @Bean
    public Timer clusteringTimer(MeterRegistry registry) {
        return Timer.builder("graph_service_clustering_duration_seconds")
                .description("Clustering operation duration")
                .register(registry);
    }

    @Bean
    public Timer tagPropagationTimer(MeterRegistry registry) {
        return Timer.builder("graph_service_tag_propagation_duration_seconds")
                .description("Tag propagation duration")
                .register(registry);
    }

    @Bean
    public Timer neo4jQueryTimer(MeterRegistry registry) {
        return Timer.builder("graph_service_neo4j_query_duration_seconds")
                .description("Neo4j query duration")
                .register(registry);
    }
}
