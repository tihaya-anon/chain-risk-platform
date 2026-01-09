package gnn

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/0ksks/chain-risk-platform/tests/e2e/framework"
	_ "github.com/lib/pq"
)

// RiskFixture represents a known risk pattern fixture
type RiskFixture struct {
	Description string         `json:"description"`
	Addresses   []AddressCase  `json:"addresses"`
}

type AddressCase struct {
	Address      string  `json:"address"`
	ExpectedRisk string  `json:"expected_risk"`
	MinScore     float64 `json:"min_score,omitempty"`
	MaxScore     float64 `json:"max_score,omitempty"`
	Pattern      string  `json:"pattern"`
	Reason       string  `json:"reason"`
}

// TestValidation_KnownHighRisk validates scoring for known high-risk patterns
func TestValidation_KnownHighRisk(t *testing.T) {
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

	// Load high-risk fixtures
	fixture := loadFixture(t, "known_high_risk.json")
	if fixture == nil {
		t.Skip("Could not load high-risk fixtures")
	}

	for _, tc := range fixture.Addresses {
		t.Run(tc.Pattern, func(t *testing.T) {
			url := env.Config.RiskServiceURL + "/api/v1/risk/" + tc.Address
			resp, err := http.Get(url)
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}
			defer resp.Body.Close()

			// For synthetic addresses, 404 is acceptable
			if resp.StatusCode == http.StatusNotFound {
				t.Logf("Address %s not found (synthetic test data)", tc.Address)
				return
			}

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Unexpected status: %d", resp.StatusCode)
				return
			}

			var result struct {
				Address string  `json:"address"`
				Score   float64 `json:"score"`
				Method  string  `json:"method"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				t.Errorf("Failed to decode response: %v", err)
				return
			}

			t.Logf("Pattern=%s Address=%s Score=%.4f MinExpected=%.2f",
				tc.Pattern, tc.Address, result.Score, tc.MinScore)

			// Validate minimum score for high-risk
			if tc.MinScore > 0 && result.Score < tc.MinScore {
				t.Errorf("High-risk address scored too low: %.4f < %.2f (pattern: %s)",
					result.Score, tc.MinScore, tc.Pattern)
			}
		})
	}
}

// TestValidation_KnownLowRisk validates scoring for known low-risk patterns
func TestValidation_KnownLowRisk(t *testing.T) {
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

	// Load low-risk fixtures
	fixture := loadFixture(t, "known_low_risk.json")
	if fixture == nil {
		t.Skip("Could not load low-risk fixtures")
	}

	for _, tc := range fixture.Addresses {
		t.Run(tc.Pattern, func(t *testing.T) {
			url := env.Config.RiskServiceURL + "/api/v1/risk/" + tc.Address
			resp, err := http.Get(url)
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}
			defer resp.Body.Close()

			// For synthetic addresses, 404 is acceptable
			if resp.StatusCode == http.StatusNotFound {
				t.Logf("Address %s not found (synthetic test data)", tc.Address)
				return
			}

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Unexpected status: %d", resp.StatusCode)
				return
			}

			var result struct {
				Address string  `json:"address"`
				Score   float64 `json:"score"`
				Method  string  `json:"method"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				t.Errorf("Failed to decode response: %v", err)
				return
			}

			t.Logf("Pattern=%s Address=%s Score=%.4f MaxExpected=%.2f",
				tc.Pattern, tc.Address, result.Score, tc.MaxScore)

			// Validate maximum score for low-risk
			if tc.MaxScore > 0 && result.Score > tc.MaxScore {
				t.Errorf("Low-risk address scored too high: %.4f > %.2f (pattern: %s)",
					result.Score, tc.MaxScore, tc.Pattern)
			}
		})
	}
}

// TestValidation_ScoreDistribution validates score distribution
func TestValidation_ScoreDistribution(t *testing.T) {
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

	// Generate random addresses and check score distribution
	testAddresses := []string{
		"0x0000000000000000000000000000000000000001",
		"0x0000000000000000000000000000000000000002",
		"0x0000000000000000000000000000000000000003",
		"0x0000000000000000000000000000000000000004",
		"0x0000000000000000000000000000000000000005",
	}

	var scores []float64
	for _, addr := range testAddresses {
		url := env.Config.RiskServiceURL + "/api/v1/risk/" + addr
		resp, err := http.Get(url)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)
			if score, ok := result["score"].(float64); ok {
				scores = append(scores, score)
			}
		}
	}

	if len(scores) == 0 {
		t.Skip("No scores collected")
		return
	}

	// Calculate basic stats
	var sum, min, max float64
	min = 1.0
	for _, s := range scores {
		sum += s
		if s < min {
			min = s
		}
		if s > max {
			max = s
		}
	}
	avg := sum / float64(len(scores))

	t.Logf("Score distribution: count=%d avg=%.4f min=%.4f max=%.4f range=%.4f",
		len(scores), avg, min, max, max-min)

	// All scores should be in [0, 1]
	for i, s := range scores {
		if s < 0 || s > 1 {
			t.Errorf("Score %d out of range [0,1]: %.4f", i, s)
		}
	}
}

// TestValidation_LatencyBounds validates response latency
func TestValidation_LatencyBounds(t *testing.T) {
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

	testAddr := "0x0000000000000000000000000000000000000001"
	maxLatency := 500 * time.Millisecond // As per acceptance criteria

	// Measure latencies
	var latencies []time.Duration
	for i := 0; i < 5; i++ {
		url := env.Config.RiskServiceURL + "/api/v1/risk/" + testAddr
		
		start := time.Now()
		resp, err := http.Get(url)
		latency := time.Since(start)
		
		if err != nil {
			continue
		}
		resp.Body.Close()
		
		latencies = append(latencies, latency)
	}

	if len(latencies) == 0 {
		t.Skip("No latency measurements")
		return
	}

	// Calculate stats
	var total time.Duration
	var max time.Duration
	for _, l := range latencies {
		total += l
		if l > max {
			max = l
		}
	}
	avg := total / time.Duration(len(latencies))

	t.Logf("Latency: avg=%v max=%v (threshold=%v)", avg, max, maxLatency)

	// Check max latency bound
	if max > maxLatency {
		t.Errorf("Max latency exceeds threshold: %v > %v", max, maxLatency)
	}
}

func loadFixture(t *testing.T, filename string) *RiskFixture {
	// Try multiple paths
	paths := []string{
		filepath.Join("fixtures", "gnn", filename),
		filepath.Join("..", "fixtures", "gnn", filename),
		filepath.Join("tests", "e2e", "fixtures", "gnn", filename),
	}

	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		var fixture RiskFixture
		if err := json.Unmarshal(data, &fixture); err != nil {
			t.Logf("Failed to parse %s: %v", path, err)
			continue
		}

		return &fixture
	}

	return nil
}
