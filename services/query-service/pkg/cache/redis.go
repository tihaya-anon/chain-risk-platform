package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

// RedisCache provides caching functionality using Redis
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache creates a new RedisCache
func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{client: client}
}

// Get retrieves a value from cache
func (c *RedisCache) Get(ctx context.Context, key string, dest interface{}) error {
	val, err := c.client.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// Set stores a value in cache with TTL
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal cache value: %w", err)
	}
	return c.client.Set(ctx, key, data, ttl).Err()
}

// Delete removes a value from cache
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

// Exists checks if a key exists in cache
func (c *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

// Key builders for consistent cache key naming
const (
	KeyPrefixAddress   = "addr:"
	KeyPrefixTransfers = "transfers:"
	KeyPrefixStats     = "stats:"
)

// AddressKey generates a cache key for address info
func AddressKey(address, network string) string {
	return fmt.Sprintf("%s%s:%s", KeyPrefixAddress, network, address)
}

// AddressTransfersKey generates a cache key for address transfers
func AddressTransfersKey(address, network string, page, pageSize int) string {
	return fmt.Sprintf("%s%s:%s:p%d:s%d", KeyPrefixTransfers, network, address, page, pageSize)
}

// AddressStatsKey generates a cache key for address stats
func AddressStatsKey(address, network string) string {
	return fmt.Sprintf("%s%s:%s", KeyPrefixStats, network, address)
}
