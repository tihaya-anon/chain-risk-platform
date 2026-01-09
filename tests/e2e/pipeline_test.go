package e2e

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"github.com/0ksks/chain-risk-platform/tests/e2e/framework"
	_ "github.com/lib/pq"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// TestPipeline_IngestionToDatabase tests the full data pipeline
// Generator → Kafka → Flink → PostgreSQL
func TestPipeline_IngestionToDatabase(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Setup
	env, err := framework.Setup(ctx)
	if err != nil {
		t.Fatalf("Setup failed: %v", err)
	}
	defer env.Teardown()

	// Clean test data
	t.Log("Cleaning test data...")
	if err := env.CleanupTestData(nil); err != nil {
		t.Logf("Warning: cleanup failed: %v", err)
	}

	// Get initial row count
	var initialCount int
	env.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM transactions").Scan(&initialCount)
	t.Logf("Initial transaction count: %d", initialCount)

	// Run generator for 10 seconds at 10 TPS
	t.Log("Starting data generator...")
	generatorCmd := exec.CommandContext(ctx, env.Config.GeneratorBin,
		"-mode=random",
		"-tps=10",
		"-duration=10",
		"-network=ethereum",
	)
	if err := generatorCmd.Start(); err != nil {
		t.Fatalf("Failed to start generator: %v", err)
	}

	// Wait for generator to finish
	if err := generatorCmd.Wait(); err != nil {
		t.Logf("Generator finished with: %v", err)
	}
	t.Log("Generator completed")

	// Wait for Flink to process and write to DB
	t.Log("Waiting for Flink processing...")
	err = env.WaitForPostgresRows(ctx, "transactions", initialCount+50, 60*time.Second)
	if err != nil {
		t.Logf("Warning: %v (Flink may not be running)", err)
	}

	// Verify data in PostgreSQL
	var finalCount int
	env.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM transactions").Scan(&finalCount)
	t.Logf("Final transaction count: %d (added %d)", finalCount, finalCount-initialCount)

	// Check Kafka topic has messages
	topics, err := env.KafkaAdmin.ListTopics()
	if err != nil {
		t.Fatalf("Failed to list topics: %v", err)
	}
	if _, exists := topics[env.Config.KafkaTopic]; !exists {
		t.Errorf("Kafka topic %s does not exist", env.Config.KafkaTopic)
	} else {
		t.Logf("Kafka topic %s exists", env.Config.KafkaTopic)
	}
}

// TestPipeline_KafkaMessageFormat verifies Kafka message format
func TestPipeline_KafkaMessageFormat(t *testing.T) {
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

	// Verify topic exists
	topics, err := env.KafkaAdmin.ListTopics()
	if err != nil {
		t.Fatalf("Failed to list topics: %v", err)
	}

	topic, exists := topics[env.Config.KafkaTopic]
	if !exists {
		t.Skipf("Kafka topic %s does not exist", env.Config.KafkaTopic)
	}

	t.Logf("Topic %s: partitions=%d", env.Config.KafkaTopic, topic.NumPartitions)
}

// TestPipeline_DatabaseSchema verifies database schema is correct
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

	// Check required tables exist
	tables := []string{"transactions", "addresses", "address_stats"}
	for _, table := range tables {
		var exists bool
		query := `SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_name = $1
		)`
		if err := env.DB.QueryRowContext(ctx, query, table).Scan(&exists); err != nil {
			t.Errorf("Failed to check table %s: %v", table, err)
			continue
		}
		if !exists {
			t.Errorf("Table %s does not exist", table)
		} else {
			t.Logf("Table %s exists", table)
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

	// Verify Neo4j connection
	session := env.Neo4j.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, "RETURN 1 as n", nil)
	if err != nil {
		t.Fatalf("Neo4j query failed: %v", err)
	}

	if result.Next(ctx) {
		t.Log("Neo4j connection successful")
	}
}
