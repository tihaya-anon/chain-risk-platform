package gnn

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/0ksks/chain-risk-platform/tests/e2e/framework"
	_ "github.com/lib/pq"
)

// TestGNN_Inference tests GNN model inference via Risk Service
func TestGNN_Inference(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	env, err := framework.Setup(ctx)
	if err != nil {
		t.Fatalf("Setup failed: %v", err)
	}
	defer env.Teardown()

	// Check Risk Service health
	riskURL := env.Config.RiskServiceURL + "/health"
	if err := env.WaitForServiceReady(ctx, riskURL, 30*time.Second); err != nil {
		t.Skipf("Risk service not running: %v", err)
	}

	testAddr := "0x0000000000000000000000000000000000000001"

	// Test single address GNN prediction
	t.Run("SinglePrediction", func(t *testing.T) {
		url := env.Config.RiskServiceURL + "/api/v1/risk/" + testAddr + "?include_details=true"
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
			return
		}

		if resp.StatusCode == http.StatusOK {
			var result struct {
				Address string  `json:"address"`
				Score   float64 `json:"score"`
				Method  string  `json:"method"`
				Details map[string]interface{} `json:"details,omitempty"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				t.Errorf("Failed to decode response: %v", err)
				return
			}

			t.Logf("Risk prediction: address=%s score=%.4f method=%s",
				result.Address, result.Score, result.Method)

			// Validate score range
			if result.Score < 0 || result.Score > 1 {
				t.Errorf("Score out of range [0,1]: %.4f", result.Score)
			}

			// Check if GNN was used
			if result.Details != nil {
				if gnn, ok := result.Details["gnn"]; ok {
					t.Logf("GNN details: %+v", gnn)
				}
			}
		}
	})

	// Test prediction latency
	t.Run("PredictionLatency", func(t *testing.T) {
		url := env.Config.RiskServiceURL + "/api/v1/risk/" + testAddr
		
		start := time.Now()
		resp, err := http.Get(url)
		latency := time.Since(start)
		
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		resp.Body.Close()

		t.Logf("Prediction latency: %v", latency)

		// Validate latency < 500ms (as per acceptance criteria)
		if latency > 500*time.Millisecond {
			t.Errorf("Latency exceeds 500ms: %v", latency)
		}
	})
}

// TestGNN_BatchInference tests batch GNN predictions
func TestGNN_BatchInference(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	env, err := framework.Setup(ctx)
	if err != nil {
		t.Fatalf("Setup failed: %v", err)
	}
	defer env.Teardown()

	// Check Risk Service health
	riskURL := env.Config.RiskServiceURL + "/health"
	if err := env.WaitForServiceReady(ctx, riskURL, 30*time.Second); err != nil {
		t.Skipf("Risk service not running: %v", err)
	}

	// Test batch prediction
	t.Run("BatchPrediction", func(t *testing.T) {
		addresses := []string{
			"0x0000000000000000000000000000000000000001",
			"0x0000000000000000000000000000000000000002",
			"0x0000000000000000000000000000000000000003",
		}

		body := map[string]interface{}{
			"addresses": addresses,
		}
		jsonBody, _ := json.Marshal(body)

		url := env.Config.RiskServiceURL + "/api/v1/risk/batch"
		start := time.Now()
		resp, err := http.Post(url, "application/json", bytes.NewReader(jsonBody))
		latency := time.Since(start)

		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("Batch prediction latency for %d addresses: %v", len(addresses), latency)

		if resp.StatusCode == http.StatusOK {
			var results []map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
				t.Errorf("Failed to decode response: %v", err)
				return
			}

			t.Logf("Batch results: %d predictions", len(results))

			for _, r := range results {
				if score, ok := r["score"].(float64); ok {
					if score < 0 || score > 1 {
						t.Errorf("Score out of range for %v: %.4f", r["address"], score)
					}
				}
			}
		}
	})
}

// TestGNN_ModelInfo tests model information endpoint
func TestGNN_ModelInfo(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	env, err := framework.Setup(ctx)
	if err != nil {
		t.Fatalf("Setup failed: %v", err)
	}
	defer env.Teardown()

	// Check Risk Service health
	riskURL := env.Config.RiskServiceURL + "/health"
	if err := env.WaitForServiceReady(ctx, riskURL, 30*time.Second); err != nil {
		t.Skipf("Risk service not running: %v", err)
	}

	// Test model status endpoint
	t.Run("ModelStatus", func(t *testing.T) {
		url := env.Config.RiskServiceURL + "/api/v1/models/status"
		resp, err := http.Get(url)
		if err != nil {
			t.Logf("Model status endpoint not available: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var status map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&status); err == nil {
				t.Logf("Model status: %+v", status)
			}
		}
	})
}
