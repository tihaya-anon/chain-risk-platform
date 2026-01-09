package framework

import (
	"context"
	"fmt"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// CleanupOptions specifies what to clean
type CleanupOptions struct {
	PostgresTables []string
	Neo4jLabels    []string
	RedisPatterns  []string
	KafkaTopics    []string
}

// DefaultCleanupOptions returns default cleanup targets
func DefaultCleanupOptions() *CleanupOptions {
	return &CleanupOptions{
		PostgresTables: []string{
			"transactions",
			"addresses",
			"address_stats",
			"alerts",
		},
		Neo4jLabels: []string{
			"Address",
			"Transaction",
		},
		RedisPatterns: []string{
			"risk:*",
			"cache:*",
			"addr:*",
		},
		KafkaTopics: []string{}, // Don't delete topics by default
	}
}

// CleanupTestData removes test data from all stores
func (e *TestEnv) CleanupTestData(opts *CleanupOptions) error {
	if opts == nil {
		opts = DefaultCleanupOptions()
	}

	ctx, cancel := context.WithTimeout(e.ctx, 60*time.Second)
	defer cancel()

	// Clean PostgreSQL
	if err := e.cleanupPostgres(ctx, opts.PostgresTables); err != nil {
		return fmt.Errorf("cleanup postgres: %w", err)
	}

	// Clean Neo4j
	if err := e.cleanupNeo4j(ctx, opts.Neo4jLabels); err != nil {
		return fmt.Errorf("cleanup neo4j: %w", err)
	}

	// Clean Redis
	if err := e.cleanupRedis(ctx, opts.RedisPatterns); err != nil {
		return fmt.Errorf("cleanup redis: %w", err)
	}

	return nil
}

func (e *TestEnv) cleanupPostgres(ctx context.Context, tables []string) error {
	for _, table := range tables {
		query := fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table)
		if _, err := e.DB.ExecContext(ctx, query); err != nil {
			// Ignore if table doesn't exist
			continue
		}
	}
	return nil
}

func (e *TestEnv) cleanupNeo4j(ctx context.Context, labels []string) error {
	session := e.Neo4j.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	for _, label := range labels {
		query := fmt.Sprintf("MATCH (n:%s) DETACH DELETE n", label)
		if _, err := session.Run(ctx, query, nil); err != nil {
			continue
		}
	}
	return nil
}

func (e *TestEnv) cleanupRedis(ctx context.Context, patterns []string) error {
	for _, pattern := range patterns {
		iter := e.Redis.Scan(ctx, 0, pattern, 1000).Iterator()
		var keys []string
		for iter.Next(ctx) {
			keys = append(keys, iter.Val())
		}
		if len(keys) > 0 {
			e.Redis.Del(ctx, keys...)
		}
	}
	return nil
}

// ResetKafkaOffsets resets consumer group offsets
func (e *TestEnv) ResetKafkaOffsets(groupID string) error {
	// Delete consumer group to reset offsets
	return e.KafkaAdmin.DeleteConsumerGroup(groupID)
}
