package com.chainrisk.orchestrator.orchestration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * BFF Client
 * Handles communication with BFF service
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BffClient {

    private final WebClient bffWebClient;

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
                .doOnError(error -> log.error("Failed to get address info: {}", error.getMessage()));
    }

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
                .doOnError(error -> log.error("Failed to get risk score: {}", error.getMessage()));
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
                .doOnError(error -> log.error("Failed to get transfers: {}", error.getMessage()));
    }
}
