package e2e

import (
	"context"
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/0ksks/chain-risk-platform/tests/e2e/framework"
	_ "github.com/lib/pq"
)

// TestPipeline_IngestionToDatabase tests the full pipeline
func TestPipeline_IngestionToDatabase(t *testing.T) {
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

	// Clean test data
	t.Log("Cleaning test data...")
	env.DB.ExecContext(ctx, "DELETE FROM chain_data.transfers WHERE block_number < 1000")
	env.DB.ExecContext(ctx, "DELETE FROM chain_data.transactions WHERE block_number < 1000")

	// Count initial records
	var initialCount int
	env.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM chain_data.transfers").Scan(&initialCount)
	t.Logf("Initial transfer count: %d", initialCount)

	// Start data generator
	t.Log("Starting data generator...")
	generatorBin := os.Getenv("GENERATOR_BIN")
	if generatorBin == "" {
		generatorBin = "../data-ingestion/bin/generator"
	}

	// Run from data-ingestion directory for config
	cmd := exec.CommandContext(ctx, generatorBin, "-mode=random", "-tps=20", "-duration=5")
	cmd.Dir = os.Getenv("PROJECT_ROOT")
	if cmd.Dir == "" {
		cmd.Dir = "../data-ingestion"
	}
	cmd.Env = append(os.Environ(), "KAFKA_BROKERS=localhost:19092")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Logf("Generator output: %s", string(output))
		t.Logf("Generator finished with: %v", err)
	}
	t.Log("Generator completed")

	// Wait for Flink processing (if running)
	t.Log("Waiting for processing...")
	time.Sleep(5 * time.Second)

	// Count final records
	var finalCount int
	env.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM chain_data.transfers").Scan(&finalCount)
	t.Logf("Final transfer count: %d (added %d)", finalCount, finalCount-initialCount)

	// Verify Kafka topic exists
	if env.Kafka != nil {
		topics, _ := env.Kafka.Topics()
		for _, topic := range topics {
			if topic == "chain-transactions" {
				t.Log("Kafka topic chain-transactions exists")
				break
			}
		}
	}
}

// TestPipeline_KafkaMessageFormat tests Kafka message format
func TestPipeline_KafkaMessageFormat(t *testing.T) {
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

	if env.Kafka == nil {
		t.Skip("Kafka not available")
	}

	// Check topic metadata
	topics, err := env.Kafka.Topics()
	if err != nil {
		t.Fatalf("Failed to get topics: %v", err)
	}

	for _, topic := range topics {
		if topic == "chain-transactions" {
			partitions, _ := env.Kafka.Partitions(topic)
			t.Logf("Topic %s: partitions=%d", topic, len(partitions))
			return
		}
	}
	t.Log("Topic chain-transactions not found (may not be created yet)")
}

// TestPipeline_DatabaseSchema verifies database schema
func TestPipeline_DatabaseSchema(t *testing.T) {
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

	// Check required tables in chain_data schema
	tables := []struct {
		schema string
		name   string
	}{
		{"chain_data", "transfers"},
		{"chain_data", "transactions"},
		{"chain_data", "processing_state"},
		{"risk", "address_risk_scores"},
		{"alert", "alerts"},
	}

	for _, table := range tables {
		var exists bool
		query := `SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = $1 AND table_name = $2
		)`
		if err := env.DB.QueryRowContext(ctx, query, table.schema, table.name).Scan(&exists); err != nil {
			t.Errorf("Failed to check table %s.%s: %v", table.schema, table.name, err)
			continue
		}
		if !exists {
			t.Logf("Table %s.%s does not exist", table.schema, table.name)
		} else {
			t.Logf("Table %s.%s exists ✓", table.schema, table.name)
		}
	}
}

// TestPipeline_Neo4jConnectivity verifies Neo4j connectivity
func TestPipeline_Neo4jConnectivity(t *testing.T) {
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

	if env.Neo4j == nil {
		t.Skip("Neo4j not available")
	}

	// Test Neo4j connection
	session := env.Neo4j.NewSession(ctx, framework.Neo4jSessionConfig())
	defer session.Close(ctx)

	result, err := session.Run(ctx, "RETURN 1 as n", nil)
	if err != nil {
		t.Fatalf("Neo4j query failed: %v", err)
	}

	if result.Next(ctx) {
		t.Log("Neo4j connection successful")
	}
}
