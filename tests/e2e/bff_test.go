package e2e

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

// TestBFF_Health tests BFF health endpoint
func TestBFF_Health(t *testing.T) {
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

	if err := env.AssertHTTPEndpoint(ctx, "GET", env.Config.BFFURL+"/health", http.StatusOK); err != nil {
		t.Skipf("BFF not running: %v", err)
	}
	t.Log("BFF health check passed")
}

// TestBFF_AddressAPI tests address-related BFF endpoints
func TestBFF_AddressAPI(t *testing.T) {
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

	baseURL := env.Config.BFFURL

	// Check BFF is running
	if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
		t.Skipf("BFF not running: %v", err)
	}

	testAddr := "0x0000000000000000000000000000000000000000"

	// Test get address
	t.Run("GetAddress", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		// 200 or 404 are both valid
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}
		t.Logf("GetAddress status: %d", resp.StatusCode)
	})

	// Test get address risk
	t.Run("GetAddressRisk", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr + "/risk")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetAddressRisk status: %d", resp.StatusCode)
	})

	// Test get address transactions
	t.Run("GetAddressTransactions", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr + "/transactions?limit=10")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetAddressTransactions status: %d", resp.StatusCode)
	})

	// Test get address graph
	t.Run("GetAddressGraph", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr + "/graph?depth=2")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetAddressGraph status: %d", resp.StatusCode)
	})
}

// TestBFF_AlertAPI tests alert-related BFF endpoints
func TestBFF_AlertAPI(t *testing.T) {
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

	baseURL := env.Config.BFFURL

	// Check BFF is running
	if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
		t.Skipf("BFF not running: %v", err)
	}

	// Test list alerts
	t.Run("ListAlerts", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/alerts?page=1&pageSize=10")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Unexpected status: %d", resp.StatusCode)
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		t.Logf("Alerts: %+v", result)
	})

	// Test alert stats
	t.Run("AlertStats", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/alerts/stats")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("AlertStats status: %d", resp.StatusCode)
	})
}

// TestBFF_RiskAPI tests risk-related BFF endpoints
func TestBFF_RiskAPI(t *testing.T) {
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

	baseURL := env.Config.BFFURL

	// Check BFF is running
	if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
		t.Skipf("BFF not running: %v", err)
	}

	// Test batch risk assessment
	t.Run("BatchRiskAssessment", func(t *testing.T) {
		body := map[string]interface{}{
			"addresses": []string{
				"0x0000000000000000000000000000000000000001",
				"0x0000000000000000000000000000000000000002",
			},
		}
		jsonBody, _ := json.Marshal(body)

		resp, err := http.Post(baseURL+"/api/risk/batch", "application/json", bytes.NewReader(jsonBody))
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("BatchRiskAssessment status: %d", resp.StatusCode)
	})
}

// TestBFF_GraphQL tests GraphQL endpoint if available
func TestBFF_GraphQL(t *testing.T) {
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

	baseURL := env.Config.BFFURL

	// Check BFF is running
	if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
		t.Skipf("BFF not running: %v", err)
	}

	// Test GraphQL endpoint
	query := map[string]string{
		"query": `{ __schema { types { name } } }`,
	}
	jsonBody, _ := json.Marshal(query)

	resp, err := http.Post(baseURL+"/graphql", "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		t.Skipf("GraphQL request failed: %v", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		t.Log("GraphQL endpoint available")
	case http.StatusNotFound:
		t.Log("GraphQL endpoint not available")
	default:
		t.Logf("GraphQL status: %d", resp.StatusCode)
	}
}

// TestBFF_CORS tests CORS headers
func TestBFF_CORS(t *testing.T) {
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

	baseURL := env.Config.BFFURL

	req, _ := http.NewRequestWithContext(ctx, "OPTIONS", baseURL+"/api/addresses/0x0", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")

	resp, err := env.HTTPClient.Do(req)
	if err != nil {
		t.Skipf("BFF not running: %v", err)
	}
	defer resp.Body.Close()

	corsHeader := resp.Header.Get("Access-Control-Allow-Origin")
	if corsHeader != "" {
		t.Logf("CORS enabled: %s", corsHeader)
	} else {
		t.Log("CORS headers not present")
	}
}
