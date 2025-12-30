package com.chainrisk.orchestrator.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI Configuration
 * Configures Swagger/OpenAPI documentation for the Orchestrator
 */
@Configuration
public class OpenApiConfig {

    @Value("${server.port:8080}")
    private int serverPort;

    @Bean
    public OpenAPI orchestratorOpenAPI() {
        final String securitySchemeName = "bearerAuth";
        
        return new OpenAPI()
                .info(new Info()
                        .title("Chain Risk Platform - Orchestrator API")
                        .description("""
                                API Gateway and Orchestration layer for Chain Risk Platform.
                                
                                ## Overview
                                The Orchestrator serves two main purposes:
                                1. **API Gateway**: Routes requests to BFF with authentication, rate limiting, and circuit breaking
                                2. **Orchestration**: Provides aggregated endpoints that combine multiple API calls
                                
                                ## Authentication
                                All endpoints (except /api/v1/auth/**) require JWT authentication.
                                Include the token in the Authorization header: `Bearer <token>`
                                
                                ## Orchestration Endpoints
                                These endpoints aggregate data from multiple services for complex queries:
                                - `/api/v1/orchestration/address-profile/{address}` - Basic address profile
                                - `/api/v1/orchestration/address-analysis/{address}` - Comprehensive analysis with graph data
                                - `/api/v1/orchestration/connection/{from}/{to}` - Find connection between addresses
                                - `/api/v1/orchestration/high-risk-network` - High-risk addresses network
                                
                                ## BFF APIs
                                Switch to "BFF APIs" in the dropdown above to see all available BFF endpoints.
                                """)
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Chain Risk Team")
                                .email("chainrisk@example.com"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT")))
                .servers(List.of(
                        new Server()
                                .url("http://localhost:" + serverPort)
                                .description("Local Development Server")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("JWT token obtained from /api/v1/auth/login")));
    }
}
