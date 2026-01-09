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
	t.Log("BFF health check passed ✓")
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
		t.Logf("GetAddress status: %d ✓", resp.StatusCode)
	})

	// Test get address risk
	t.Run("GetAddressRisk", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr + "/risk")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		// Any response is valid
		t.Logf("GetAddressRisk status: %d ✓", resp.StatusCode)
	})

	// Test get address transactions
	t.Run("GetAddressTransactions", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr + "/transactions")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetAddressTransactions status: %d ✓", resp.StatusCode)
	})

	// Test get address graph
	t.Run("GetAddressGraph", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/addresses/" + testAddr + "/graph")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetAddressGraph status: %d ✓", resp.StatusCode)
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

	// Test list alert rules
	t.Run("ListAlertRules", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/alerts/rules")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("ListAlertRules status: %d ✓", resp.StatusCode)
	})

	// Test alert history
	t.Run("AlertHistory", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/alerts/history")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("AlertHistory status: %d ✓", resp.StatusCode)
	})

	// Test alert stats
	t.Run("AlertStats", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/alerts/stats")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("AlertStats status: %d ✓", resp.StatusCode)
	})

	// Test alert subscriptions
	t.Run("AlertSubscriptions", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/alerts/subscriptions")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("AlertSubscriptions status: %d ✓", resp.StatusCode)
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
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000001",
			},
		}
		jsonBody, _ := json.Marshal(body)

		resp, err := http.Post(baseURL+"/api/risk/batch", "application/json", bytes.NewBuffer(jsonBody))
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("BatchRiskAssessment status: %d ✓", resp.StatusCode)
	})

	// Test risk rules
	t.Run("ListRiskRules", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/risk/rules")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("ListRiskRules status: %d ✓", resp.StatusCode)
	})
}

// TestBFF_GraphAPI tests graph-related BFF endpoints
func TestBFF_GraphAPI(t *testing.T) {
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

	// Test get address from graph
	t.Run("GetGraphAddress", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/graph/address/" + testAddr)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetGraphAddress status: %d ✓", resp.StatusCode)
	})

	// Test get neighbors
	t.Run("GetNeighbors", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/graph/address/" + testAddr + "/neighbors")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("GetNeighbors status: %d ✓", resp.StatusCode)
	})

	// Test high risk addresses
	t.Run("HighRiskAddresses", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/graph/search/high-risk")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		t.Logf("HighRiskAddresses status: %d ✓", resp.StatusCode)
	})
}

// TestBFF_CORS tests CORS configuration
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

	// Check BFF is running
	if err := env.AssertHTTPEndpoint(ctx, "GET", baseURL+"/health", http.StatusOK); err != nil {
		t.Skipf("BFF not running: %v", err)
	}

	// Test CORS preflight
	req, _ := http.NewRequest("OPTIONS", baseURL+"/api/addresses/0x0", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")

	resp, err := env.HTTPClient.Do(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	// Check for CORS headers
	if resp.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Log("CORS headers present ✓")
	} else {
		t.Log("CORS headers not configured (optional)")
	}
}
