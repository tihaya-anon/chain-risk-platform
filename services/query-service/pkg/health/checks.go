package health

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// PostgresCheck creates a health check for PostgreSQL
func PostgresCheck(db *gorm.DB) CheckFunc {
	return func(ctx context.Context) error {
		sqlDB, err := db.DB()
		if err != nil {
			return err
		}
		return sqlDB.PingContext(ctx)
	}
}

// RedisCheck creates a health check for Redis
func RedisCheck(client *redis.Client) CheckFunc {
	return func(ctx context.Context) error {
		if client == nil {
			return nil // Redis is optional
		}
		return client.Ping(ctx).Err()
	}
}

// AddDefaultChecks adds common health checks for Go services
func (c *Checker) AddDefaultChecks(db *gorm.DB, redis *redis.Client) {
	c.AddCheck("postgres", PostgresCheck(db), 3*time.Second)
	if redis != nil {
		c.AddCheck("redis", RedisCheck(redis), 2*time.Second)
	}
}
