package com.chainrisk.graph.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for adding tags to an address
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddTagRequest {

    /**
     * Tags to add
     */
    @NotBlank(message = "At least one tag is required")
    private List<String> tags;

    /**
     * Source of the tag (e.g., "manual", "external_api", "ml_model")
     */
    @Builder.Default
    private String source = "manual";

    /**
     * Confidence score (0.0 - 1.0)
     */
    @Builder.Default
    private Double confidence = 1.0;
}
