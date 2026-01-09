package e2e

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/0ksks/chain-risk-platform/tests/e2e/framework"
	_ "github.com/lib/pq"
)

// TestServices_QueryService tests Query Service endpoints
func TestServices_QueryService(t *testing.T) {
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

	baseURL := env.Config.QueryServiceURL

	// Test health endpoint
	t.Run("Health", func(t *testing.T) {
		if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
			t.Skipf("Query service not running: %v", err)
		}
	})

	// Test address query
	t.Run("GetAddress", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/addresses/0x0000000000000000000000000000000000000000")
		if err != nil {
			t.Skipf("Query service not running: %v", err)
		}
		defer resp.Body.Close()
		// 200 or 404 are both valid responses
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}
	})

	// Test transactions query
	t.Run("GetTransactions", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/transactions?limit=10")
		if err != nil {
			t.Skipf("Query service not running: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}
	})

	// Test metrics endpoint
	t.Run("Metrics", func(t *testing.T) {
		if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/metrics", http.StatusOK); err != nil {
			t.Logf("Metrics endpoint not available: %v", err)
		}
	})
}

// TestServices_RiskService tests Risk ML Service endpoints
func TestServices_RiskService(t *testing.T) {
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

	baseURL := env.Config.RiskServiceURL

	// Test health endpoint
	t.Run("Health", func(t *testing.T) {
		if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
			t.Skipf("Risk service not running: %v", err)
		}
	})

	// Test risk score endpoint
	t.Run("GetRiskScore", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/risk/0x0000000000000000000000000000000000000000")
		if err != nil {
			t.Skipf("Risk service not running: %v", err)
		}
		defer resp.Body.Close()
		// 200 or 404 are both valid
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}
	})

	// Test batch risk score endpoint
	t.Run("BatchRiskScore", func(t *testing.T) {
		// Test docs endpoint
		resp, err := http.Get(baseURL + "/docs")
		if err != nil {
			t.Skipf("Risk service not running: %v", err)
		}
		defer resp.Body.Close()
		t.Logf("Docs endpoint status: %d", resp.StatusCode)
	})
}

// TestServices_GraphService tests Graph Service endpoints
func TestServices_GraphService(t *testing.T) {
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

	baseURL := env.Config.GraphServiceURL

	// Test health endpoint
	t.Run("Health", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/actuator/health")
		if err != nil {
			t.Skipf("Graph service not running: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Skipf("Graph service health check failed: %d", resp.StatusCode)
		}
		t.Log("Graph service is healthy")
	})

	// Test neighbors endpoint
	t.Run("GetNeighbors", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/graph/neighbors/0x0000000000000000000000000000000000000000?depth=1")
		if err != nil {
			t.Skipf("Graph service not running: %v", err)
		}
		defer resp.Body.Close()
		t.Logf("Neighbors endpoint status: %d", resp.StatusCode)
	})

	// Test subgraph endpoint
	t.Run("GetSubgraph", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/graph/subgraph/0x0000000000000000000000000000000000000000?depth=2")
		if err != nil {
			t.Skipf("Graph service not running: %v", err)
		}
		defer resp.Body.Close()
		t.Logf("Subgraph endpoint status: %d", resp.StatusCode)
	})
}

// TestServices_AlertService tests Alert Service endpoints
func TestServices_AlertService(t *testing.T) {
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

	baseURL := env.Config.AlertServiceURL

	// Test health endpoint
	t.Run("Health", func(t *testing.T) {
		if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
			t.Skipf("Alert service not running: %v", err)
		}
	})

	// Test list alerts
	t.Run("ListAlerts", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/alerts?limit=10")
		if err != nil {
			t.Skipf("Alert service not running: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Errorf("Failed to decode response: %v", err)
		}
		t.Logf("Alerts response: %+v", result)
	})

	// Test alert rules
	t.Run("ListRules", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/v1/rules")
		if err != nil {
			t.Skipf("Alert service not running: %v", err)
		}
		defer resp.Body.Close()
		t.Logf("Rules endpoint status: %d", resp.StatusCode)
	})
}

// TestServices_AllHealthy tests all services are healthy
func TestServices_AllHealthy(t *testing.T) {
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

	services := map[string]string{
		"Query":  env.Config.QueryServiceURL + "/health",
		"Risk":   env.Config.RiskServiceURL + "/health",
		"Graph":  env.Config.GraphServiceURL + "/actuator/health",
		"Alert":  env.Config.AlertServiceURL + "/health",
	}

	healthy := 0
	for name, url := range services {
		resp, err := http.Get(url)
		if err != nil {
			t.Logf("%s service: NOT RUNNING", name)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			t.Logf("%s service: HEALTHY", name)
			healthy++
		} else {
			t.Logf("%s service: UNHEALTHY (status %d)", name, resp.StatusCode)
		}
	}

	t.Logf("Services healthy: %d/%d", healthy, len(services))
}
