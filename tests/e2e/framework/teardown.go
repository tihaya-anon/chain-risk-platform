package framework

import (
	"context"
	"fmt"
)

// Teardown closes all connections
func (e *TestEnv) Teardown() {
	if e.cancel != nil {
		e.cancel()
	}

	if e.DB != nil {
		e.DB.Close()
	}

	if e.Redis != nil {
		e.Redis.Close()
	}

	if e.Neo4j != nil {
		e.Neo4j.Close(context.Background())
	}

	if e.Kafka != nil {
		e.Kafka.Close()
	}
}

// CleanupTestData removes test data from databases
func (e *TestEnv) CleanupTestData(ctx context.Context) error {
	// Clean PostgreSQL test data
	if e.DB != nil {
		tables := []string{
			"chain_data.transfers",
			"chain_data.transactions",
			"risk.address_risk_scores",
			"alert.alerts",
		}
		for _, table := range tables {
			_, err := e.DB.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s WHERE block_number < 1000", table))
			if err != nil {
				// Table might not exist, continue
				continue
			}
		}
	}

	// Clean Redis test data
	if e.Redis != nil {
		// Delete test keys with pattern
		iter := e.Redis.Scan(ctx, 0, "test:*", 100).Iterator()
		var keys []string
		for iter.Next(ctx) {
			keys = append(keys, iter.Val())
		}
		if len(keys) > 0 {
			e.Redis.Del(ctx, keys...)
		}
	}

	// Clean Neo4j test data
	if e.Neo4j != nil {
		session := e.Neo4j.NewSession(ctx, Neo4jSessionConfig())
		defer session.Close(ctx)
		// Delete test nodes (with test label or low block numbers)
		session.Run(ctx, "MATCH (n:TestNode) DETACH DELETE n", nil)
	}

	return nil
}

// ResetKafkaOffsets resets consumer group offsets
func (e *TestEnv) ResetKafkaOffsets(groupID string) error {
	if e.Kafka == nil {
		return fmt.Errorf("kafka not connected")
	}
	return e.Kafka.DeleteConsumerGroup(groupID)
}
