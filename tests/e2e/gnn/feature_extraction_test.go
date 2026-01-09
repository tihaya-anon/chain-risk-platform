package gnn

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/0ksks/chain-risk-platform/tests/e2e/framework"
	_ "github.com/lib/pq"
)

// TestGNN_FeatureExtraction tests feature extraction from Graph Service
func TestGNN_FeatureExtraction(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	env, err := framework.Setup(ctx)
	if err != nil {
		t.Fatalf("Setup failed: %v", err)
	}
	defer env.Teardown()

	// Check Graph Service health
	graphURL := env.Config.GraphServiceURL + "/actuator/health"
	if err := env.WaitForServiceReady(ctx, graphURL, 30*time.Second); err != nil {
		t.Skipf("Graph service not running: %v", err)
	}

	testAddr := "0x0000000000000000000000000000000000000001"

	// Test neighbors endpoint (used for feature extraction)
	t.Run("GetNeighbors", func(t *testing.T) {
		url := env.Config.GraphServiceURL + "/api/v1/graph/neighbors/" + testAddr + "?depth=2"
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		// 200 or 404 are valid (address may not exist)
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}

		if resp.StatusCode == http.StatusOK {
			var result map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				t.Errorf("Failed to decode response: %v", err)
			}
			t.Logf("Neighbors response: %d nodes", len(result))
		}
	})

	// Test subgraph endpoint
	t.Run("GetSubgraph", func(t *testing.T) {
		url := env.Config.GraphServiceURL + "/api/v1/graph/subgraph/" + testAddr + "?depth=2&limit=50"
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("Subgraph status: %d", resp.StatusCode)

		if resp.StatusCode == http.StatusOK {
			var result struct {
				Nodes []map[string]interface{} `json:"nodes"`
				Edges []map[string]interface{} `json:"edges"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
				t.Logf("Subgraph: %d nodes, %d edges", len(result.Nodes), len(result.Edges))
			}
		}
	})

	// Test address stats endpoint (provides features)
	t.Run("GetAddressStats", func(t *testing.T) {
		url := env.Config.GraphServiceURL + "/api/v1/graph/stats/" + testAddr
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("Stats status: %d", resp.StatusCode)
	})
}

// TestGNN_FeatureClient tests feature client from Risk Service
func TestGNN_FeatureClient(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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

	// Test internal features endpoint
	t.Run("InternalFeatures", func(t *testing.T) {
		url := env.Config.RiskServiceURL + "/api/v1/internal/features/0x0000000000000000000000000000000000000001"
		resp, err := http.Get(url)
		if err != nil {
			t.Logf("Internal features endpoint: %v", err)
			return
		}
		defer resp.Body.Close()

		t.Logf("Internal features status: %d", resp.StatusCode)
	})
}
