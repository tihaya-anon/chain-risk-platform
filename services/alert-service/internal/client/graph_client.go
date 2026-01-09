package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// GraphServiceClient interacts with Graph Service API
type GraphServiceClient struct {
	baseURL string
	client  *http.Client
	logger  *zap.Logger
}

// NewGraphServiceClient creates a new Graph Service client
func NewGraphServiceClient(baseURL string, timeout time.Duration, logger *zap.Logger) *GraphServiceClient {
	return &GraphServiceClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: timeout,
		},
		logger: logger,
	}
}

// AddressTagsResponse represents the response from get address tags API
type AddressTagsResponse struct {
	Address string   `json:"address"`
	Tags    []string `json:"tags"`
}

// GetAddressTags retrieves tags for an address from Graph Service
func (c *GraphServiceClient) GetAddressTags(ctx context.Context, address string) ([]string, error) {
	url := fmt.Sprintf("%s/api/v1/addresses/%s/tags", c.baseURL, address)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return []string{}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result AddressTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return result.Tags, nil
}

// ClusterRiskResponse represents cluster risk data
type ClusterRiskResponse struct {
	ClusterID   string   `json:"cluster_id"`
	RiskScore   float64  `json:"risk_score"`
	AddressCount int     `json:"address_count"`
	Tags        []string `json:"tags"`
}

// GetClusterByAddress retrieves cluster info for an address
func (c *GraphServiceClient) GetClusterByAddress(ctx context.Context, address string) (*ClusterRiskResponse, error) {
	url := fmt.Sprintf("%s/api/v1/clusters/by-address/%s", c.baseURL, address)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result ClusterRiskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}
