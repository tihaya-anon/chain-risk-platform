
package com.chainrisk.graph.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI / Swagger Configuration
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI graphEngineOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Graph Engine API")
                        .description("Address clustering and tag propagation service for Chain Risk Platform")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Chain Risk Team")
                                .email("chainrisk@example.com"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT")))
                .servers(List.of(
                        new Server().url("/").description("Default Server")
                ));
    }
}
