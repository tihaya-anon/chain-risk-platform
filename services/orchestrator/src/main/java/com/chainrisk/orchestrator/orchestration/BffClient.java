package com.chainrisk.orchestrator.orchestration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * BFF Client
 * Handles communication with BFF service
 */
@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("unchecked")
public class BffClient {

    private final WebClient bffWebClient;

    // ============== Address APIs ==============

    /**
     * Get address information
     */
    public Mono<Map<String, Object>> getAddressInfo(String address, String network, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/addresses/{address}")
                        .queryParam("network", network)
                        .build(address))
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get address info: {}", error.getMessage()));
    }

    /**
     * Get address transfers
     */
    public Mono<Map<String, Object>> getAddressTransfers(String address, String network, int page, int pageSize, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/addresses/{address}/transfers")
                        .queryParam("network", network)
                        .queryParam("page", page)
                        .queryParam("pageSize", pageSize)
                        .build(address))
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get transfers: {}", error.getMessage()));
    }

    // ============== Risk APIs ==============

    /**
     * Get risk score
     */
    public Mono<Map<String, Object>> getRiskScore(String address, String network, Map<String, String> userHeaders) {
        return bffWebClient
                .post()
                .uri("/api/v1/risk/score")
                .headers(headers -> userHeaders.forEach(headers::add))
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of(
                        "address", address,
                        "network", network,
                        "includeFactors", true
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get risk score: {}", error.getMessage()));
    }

    // ============== Graph APIs ==============

    /**
     * Get address info from graph
     */
    public Mono<Map<String, Object>> getGraphAddressInfo(String address, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri("/api/v1/graph/address/{address}", address)
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get graph address info: {}", error.getMessage()));
    }

    /**
     * Get address neighbors from graph
     */
    public Mono<Map<String, Object>> getGraphAddressNeighbors(String address, int depth, int limit, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/graph/address/{address}/neighbors")
                        .queryParam("depth", depth)
                        .queryParam("limit", limit)
                        .build(address))
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get graph neighbors: {}", error.getMessage()));
    }

    /**
     * Get address tags from graph
     */
    public Mono<List<String>> getGraphAddressTags(String address, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri("/api/v1/graph/address/{address}/tags", address)
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(List.class)
                .map(list -> (List<String>) list)
                .doOnError(error -> log.error("Failed to get graph tags: {}", error.getMessage()));
    }

    /**
     * Get address cluster from graph
     */
    public Mono<Map<String, Object>> getGraphAddressCluster(String address, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri("/api/v1/graph/address/{address}/cluster", address)
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get graph cluster: {}", error.getMessage()));
    }

    /**
     * Find path between two addresses
     */
    public Mono<Map<String, Object>> getGraphPath(String fromAddress, String toAddress, int maxDepth, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/graph/path/{fromAddress}/{toAddress}")
                        .queryParam("maxDepth", maxDepth)
                        .build(fromAddress, toAddress))
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .map(map -> (Map<String, Object>) map)
                .doOnError(error -> log.error("Failed to get graph path: {}", error.getMessage()));
    }

    /**
     * Search addresses by tag
     */
    public Mono<List<Map<String, Object>>> searchGraphByTag(String tag, int limit, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/graph/search/tag/{tag}")
                        .queryParam("limit", limit)
                        .build(tag))
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(List.class)
                .map(list -> (List<Map<String, Object>>) list)
                .doOnError(error -> log.error("Failed to search by tag: {}", error.getMessage()));
    }

    /**
     * Get high-risk addresses from graph
     */
    public Mono<List<Map<String, Object>>> getGraphHighRiskAddresses(double threshold, int limit, Map<String, String> userHeaders) {
        return bffWebClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/graph/search/high-risk")
                        .queryParam("threshold", threshold)
                        .queryParam("limit", limit)
                        .build())
                .headers(headers -> userHeaders.forEach(headers::add))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(List.class)
                .map(list -> (List<Map<String, Object>>) list)
                .doOnError(error -> log.error("Failed to get high-risk addresses: {}", error.getMessage()));
    }
}
