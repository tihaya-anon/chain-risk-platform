package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// RiskServiceClient interacts with Risk Service API
type RiskServiceClient struct {
	baseURL string
	client  *http.Client
	logger  *zap.Logger
}

// NewRiskServiceClient creates a new Risk Service client
func NewRiskServiceClient(baseURL string, timeout time.Duration, logger *zap.Logger) *RiskServiceClient {
	return &RiskServiceClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: timeout,
		},
		logger: logger,
	}
}

// RiskScoreResponse represents the response from risk score API
type RiskScoreResponse struct {
	Address   string   `json:"address"`
	Score     float64  `json:"score"`
	Level     string   `json:"level"`
	Factors   []string `json:"factors"`
	UpdatedAt string   `json:"updated_at"`
}

// GetRiskScore retrieves risk score for an address from Risk Service
func (c *RiskServiceClient) GetRiskScore(ctx context.Context, address string) (*RiskScoreResponse, error) {
	url := fmt.Sprintf("%s/api/v1/risk/%s", c.baseURL, address)

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

	var result RiskScoreResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}
