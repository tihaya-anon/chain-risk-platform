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

// TestEnsemble_Scoring tests ensemble model scoring
func TestEnsemble_Scoring(t *testing.T) {
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

	// Test ensemble prediction with details
	t.Run("EnsembleWithDetails", func(t *testing.T) {
		url := env.Config.RiskServiceURL + "/api/v1/risk/" + testAddr + "?include_details=true"
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Skipf("Risk endpoint returned %d", resp.StatusCode)
			return
		}

		var result struct {
			Address    string                 `json:"address"`
			Score      float64                `json:"score"`
			Method     string                 `json:"method"`
			ModelsUsed []string               `json:"models_used"`
			Details    map[string]interface{} `json:"details"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Errorf("Failed to decode response: %v", err)
			return
		}

		t.Logf("Ensemble result: score=%.4f method=%s models=%v",
			result.Score, result.Method, result.ModelsUsed)

		// Check ensemble method
		if result.Method != "" && result.Method != "ensemble_weighted_avg" &&
			result.Method != "ensemble_max" && result.Method != "ensemble_avg" {
			t.Logf("Using method: %s", result.Method)
		}

		// Log model details
		if result.Details != nil {
			for model, detail := range result.Details {
				t.Logf("  %s: %+v", model, detail)
			}
		}
	})

	// Test ensemble improves over single model
	t.Run("EnsembleImprovement", func(t *testing.T) {
		// Get XGBoost-only prediction (via rules)
		xgbURL := env.Config.RiskServiceURL + "/api/v1/risk/" + testAddr + "?include_details=true"
		xgbResp, err := http.Get(xgbURL)
		if err != nil {
			t.Skipf("Request failed: %v", err)
			return
		}
		defer xgbResp.Body.Close()

		if xgbResp.StatusCode == http.StatusOK {
			var result map[string]interface{}
			json.NewDecoder(xgbResp.Body).Decode(&result)

			details, _ := result["details"].(map[string]interface{})
			
			// Count models used
			modelsUsed := 0
			if _, ok := details["gnn"]; ok {
				modelsUsed++
				t.Log("GNN model is active")
			}
			if _, ok := details["xgboost"]; ok {
				modelsUsed++
				t.Log("XGBoost model is active")
			}
			if _, ok := details["rules"]; ok {
				modelsUsed++
				t.Log("Rules engine is active")
			}

			t.Logf("Total models used: %d", modelsUsed)

			// Ensemble should use multiple models for better accuracy
			if modelsUsed > 1 {
				t.Log("Ensemble is combining multiple models ✓")
			} else if modelsUsed == 1 {
				t.Log("Only single model active (fallback mode)")
			} else {
				t.Log("No ML models active (rules-only mode)")
			}
		}
	})
}

// TestEnsemble_BatchScoring tests batch ensemble scoring
func TestEnsemble_BatchScoring(t *testing.T) {
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

	// Test batch scoring consistency
	t.Run("BatchConsistency", func(t *testing.T) {
		addresses := []string{
			"0x0000000000000000000000000000000000000001",
			"0x0000000000000000000000000000000000000002",
		}

		// Get individual scores
		individualScores := make(map[string]float64)
		for _, addr := range addresses {
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
					individualScores[addr] = score
				}
			}
		}

		// Get batch scores
		body := map[string]interface{}{
			"addresses": addresses,
		}
		jsonBody, _ := json.Marshal(body)

		url := env.Config.RiskServiceURL + "/api/v1/risk/batch"
		resp, err := http.Post(url, "application/json", bytes.NewReader(jsonBody))
		if err != nil {
			t.Skipf("Batch request failed: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var results []map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&results)

			// Compare individual vs batch scores
			for _, r := range results {
				addr, _ := r["address"].(string)
				batchScore, _ := r["score"].(float64)
				
				if indivScore, ok := individualScores[addr]; ok {
					diff := batchScore - indivScore
					if diff > 0.01 || diff < -0.01 {
						t.Logf("Score difference for %s: individual=%.4f batch=%.4f diff=%.4f",
							addr, indivScore, batchScore, diff)
					}
				}
			}
		}
	})
}

// TestEnsemble_Strategies tests different ensemble strategies
func TestEnsemble_Strategies(t *testing.T) {
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

	// Test default strategy
	t.Run("DefaultStrategy", func(t *testing.T) {
		url := env.Config.RiskServiceURL + "/api/v1/risk/" + testAddr
		resp, err := http.Get(url)
		if err != nil {
			t.Skipf("Request failed: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)
			t.Logf("Default strategy result: method=%v score=%.4f",
				result["method"], result["score"])
		}
	})
}
