package com.chainrisk.orchestrator.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * WebClient Configuration
 */
@Configuration
public class WebClientConfig {

    @Value("${services.bff.url:http://localhost:3001}")
    private String bffUrl;

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    @Bean
    public WebClient bffWebClient(WebClient.Builder webClientBuilder) {
        return webClientBuilder
                .baseUrl(bffUrl)
                .build();
    }
}
