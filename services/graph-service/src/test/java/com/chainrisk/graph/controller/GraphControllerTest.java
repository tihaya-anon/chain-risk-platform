package com.chainrisk.graph.controller;

import com.chainrisk.graph.model.dto.*;
import com.chainrisk.graph.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(GraphController.class)
class GraphControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GraphQueryService graphQueryService;

    @MockBean
    private ClusteringService clusteringService;

    @MockBean
    private TagPropagationService tagPropagationService;

    private static final String TEST_ADDRESS = "0x28c6c06298d514db089934071355e5743bf21d60";

    @Nested
    @DisplayName("GET /api/v1/graph/address/{address}/neighbors")
    class GetNeighborsTests {

        @Test
        @DisplayName("should return 200 with valid depth parameter")
        void shouldReturn200WithValidDepth() throws Exception {
            AddressNeighborsResponse response = AddressNeighborsResponse.builder()
                    .address(TEST_ADDRESS)
                    .depth(2)
                    .nodes(Collections.emptyList())
                    .edges(Collections.emptyList())
                    .build();

            when(graphQueryService.getNeighbors(anyString(), anyInt(), anyInt()))
                    .thenReturn(response);

            mockMvc.perform(get("/api/v1/graph/address/{address}/neighbors", TEST_ADDRESS)
                            .param("depth", "2")
                            .param("limit", "50"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.address").value(TEST_ADDRESS));

            verify(graphQueryService).getNeighbors(TEST_ADDRESS, 2, 50);
        }

        @Test
        @DisplayName("should return 400 when depth exceeds maximum (3)")
        void shouldReturn400WhenDepthExceedsMax() throws Exception {
            mockMvc.perform(get("/api/v1/graph/address/{address}/neighbors", TEST_ADDRESS)
                            .param("depth", "10"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Validation Error"));

            verifyNoInteractions(graphQueryService);
        }

        @Test
        @DisplayName("should return 400 when depth is less than minimum (1)")
        void shouldReturn400WhenDepthBelowMin() throws Exception {
            mockMvc.perform(get("/api/v1/graph/address/{address}/neighbors", TEST_ADDRESS)
                            .param("depth", "0"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(graphQueryService);
        }

        @Test
        @DisplayName("should return 400 when limit exceeds maximum (200)")
        void shouldReturn400WhenLimitExceedsMax() throws Exception {
            mockMvc.perform(get("/api/v1/graph/address/{address}/neighbors", TEST_ADDRESS)
                            .param("limit", "500"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(graphQueryService);
        }

        @Test
        @DisplayName("should use default values when params not provided")
        void shouldUseDefaultValues() throws Exception {
            AddressNeighborsResponse response = AddressNeighborsResponse.builder()
                    .address(TEST_ADDRESS)
                    .depth(1)
                    .nodes(Collections.emptyList())
                    .edges(Collections.emptyList())
                    .build();

            when(graphQueryService.getNeighbors(anyString(), anyInt(), anyInt()))
                    .thenReturn(response);

            mockMvc.perform(get("/api/v1/graph/address/{address}/neighbors", TEST_ADDRESS))
                    .andExpect(status().isOk());

            verify(graphQueryService).getNeighbors(TEST_ADDRESS, 1, 50);
        }
    }

    @Nested
    @DisplayName("GET /api/v1/graph/search/high-risk")
    class GetHighRiskAddressesTests {

        @Test
        @DisplayName("should return 200 with valid threshold")
        void shouldReturn200WithValidThreshold() throws Exception {
            when(graphQueryService.getHighRiskAddresses(anyDouble(), anyInt()))
                    .thenReturn(Collections.emptyList());

            mockMvc.perform(get("/api/v1/graph/search/high-risk")
                            .param("threshold", "0.8")
                            .param("limit", "100"))
                    .andExpect(status().isOk());

            verify(graphQueryService).getHighRiskAddresses(0.8, 100);
        }

        @Test
        @DisplayName("should return 400 when threshold exceeds 1.0")
        void shouldReturn400WhenThresholdExceedsMax() throws Exception {
            mockMvc.perform(get("/api/v1/graph/search/high-risk")
                            .param("threshold", "1.5"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Validation Error"));

            verifyNoInteractions(graphQueryService);
        }

        @Test
        @DisplayName("should return 400 when threshold is negative")
        void shouldReturn400WhenThresholdNegative() throws Exception {
            mockMvc.perform(get("/api/v1/graph/search/high-risk")
                            .param("threshold", "-0.5"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(graphQueryService);
        }
    }

    @Nested
    @DisplayName("POST /api/v1/graph/address/{address}/tags")
    class AddTagsTests {

        @Test
        @DisplayName("should return 200 when tags added successfully")
        void shouldReturn200WhenTagsAdded() throws Exception {
            AddTagRequest request = new AddTagRequest();
            request.setTags(Arrays.asList("exchange", "verified"));

            AddressInfoResponse addressInfo = AddressInfoResponse.builder()
                    .address(TEST_ADDRESS)
                    .tags(Arrays.asList("exchange", "verified"))
                    .build();

            when(tagPropagationService.addTags(anyString(), anyList())).thenReturn(true);
            when(graphQueryService.getAddressInfo(anyString())).thenReturn(Optional.of(addressInfo));

            mockMvc.perform(post("/api/v1/graph/address/{address}/tags", TEST_ADDRESS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.address").value(TEST_ADDRESS))
                    .andExpect(jsonPath("$.tags").isArray());

            verify(tagPropagationService).addTags(eq(TEST_ADDRESS), eq(Arrays.asList("exchange", "verified")));
        }

        @Test
        @DisplayName("should return 400 when tags field is missing")
        void shouldReturn400WhenTagsMissing() throws Exception {
            mockMvc.perform(post("/api/v1/graph/address/{address}/tags", TEST_ADDRESS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"source\": \"test\"}"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(tagPropagationService);
        }

        @Test
        @DisplayName("should return 400 when request body is empty")
        void shouldReturn400WhenBodyEmpty() throws Exception {
            mockMvc.perform(post("/api/v1/graph/address/{address}/tags", TEST_ADDRESS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(tagPropagationService);
        }

        @Test
        @DisplayName("should return 500 when service throws exception")
        void shouldReturn500WhenServiceFails() throws Exception {
            AddTagRequest request = new AddTagRequest();
            request.setTags(Arrays.asList("test"));

            when(tagPropagationService.addTags(anyString(), anyList()))
                    .thenThrow(new RuntimeException("Neo4j connection failed"));

            mockMvc.perform(post("/api/v1/graph/address/{address}/tags", TEST_ADDRESS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.error").value("Internal error"));
        }

        @Test
        @DisplayName("should return success message for newly created address")
        void shouldReturnSuccessForNewAddress() throws Exception {
            AddTagRequest request = new AddTagRequest();
            request.setTags(Arrays.asList("test"));

            when(tagPropagationService.addTags(anyString(), anyList())).thenReturn(true);
            when(graphQueryService.getAddressInfo(anyString())).thenReturn(Optional.empty());

            mockMvc.perform(post("/api/v1/graph/address/{address}/tags", TEST_ADDRESS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Tags added to new address"));
        }
    }

    @Nested
    @DisplayName("GET /api/v1/graph/path/{from}/{to}")
    class FindPathTests {

        @Test
        @DisplayName("should return 400 when maxDepth exceeds 10")
        void shouldReturn400WhenMaxDepthExceedsLimit() throws Exception {
            mockMvc.perform(get("/api/v1/graph/path/{from}/{to}", TEST_ADDRESS, TEST_ADDRESS)
                            .param("maxDepth", "15"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(graphQueryService);
        }

        @Test
        @DisplayName("should return 200 with valid maxDepth")
        void shouldReturn200WithValidMaxDepth() throws Exception {
            PathResponse response = PathResponse.builder()
                    .found(false)
                    .build();

            when(graphQueryService.findPath(anyString(), anyString(), anyInt()))
                    .thenReturn(response);

            mockMvc.perform(get("/api/v1/graph/path/{from}/{to}", TEST_ADDRESS, TEST_ADDRESS)
                            .param("maxDepth", "5"))
                    .andExpect(status().isOk());

            verify(graphQueryService).findPath(TEST_ADDRESS, TEST_ADDRESS, 5);
        }
    }

    @Nested
    @DisplayName("GET /api/v1/graph/search/tag/{tag}")
    class SearchByTagTests {

        @Test
        @DisplayName("should return 400 when limit exceeds 200")
        void shouldReturn400WhenLimitExceedsMax() throws Exception {
            mockMvc.perform(get("/api/v1/graph/search/tag/{tag}", "exchange")
                            .param("limit", "500"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(graphQueryService);
        }

        @Test
        @DisplayName("should return 200 with valid limit")
        void shouldReturn200WithValidLimit() throws Exception {
            when(graphQueryService.searchByTag(anyString(), anyInt()))
                    .thenReturn(Collections.emptyList());

            mockMvc.perform(get("/api/v1/graph/search/tag/{tag}", "exchange")
                            .param("limit", "100"))
                    .andExpect(status().isOk());

            verify(graphQueryService).searchByTag("exchange", 100);
        }
    }
}
