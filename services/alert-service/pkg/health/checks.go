package health

import (
	"context"
	"database/sql"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
)

// PostgresCheck creates a health check for PostgreSQL
func PostgresCheck(db *sql.DB) CheckFunc {
	return func(ctx context.Context) error {
		return db.PingContext(ctx)
	}
}

// RedisCheck creates a health check for Redis
func RedisCheck(client *redis.Client) CheckFunc {
	return func(ctx context.Context) error {
		if client == nil {
			return nil
		}
		return client.Ping(ctx).Err()
	}
}

// KafkaCheck creates a health check for Kafka connectivity
func KafkaCheck(brokers []string) CheckFunc {
	return func(ctx context.Context) error {
		conn, err := kafka.DialContext(ctx, "tcp", brokers[0])
		if err != nil {
			return err
		}
		defer conn.Close()
		return nil
	}
}

// AddDefaultChecks adds common health checks for alert service
func (c *Checker) AddDefaultChecks(db *sql.DB, redis *redis.Client, kafkaBrokers []string) {
	if db != nil {
		c.AddCheck("postgres", PostgresCheck(db), 3*time.Second)
	}
	if redis != nil {
		c.AddCheck("redis", RedisCheck(redis), 2*time.Second)
	}
	if len(kafkaBrokers) > 0 {
		c.AddCheck("kafka", KafkaCheck(kafkaBrokers), 5*time.Second)
	}
}
