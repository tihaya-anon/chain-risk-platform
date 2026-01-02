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

// CacheStats holds cache statistics
type CacheStats struct {
	Hits       int64  `json:"hits"`
	Misses     int64  `json:"misses"`
	HitRate    string `json:"hitRate"`
	Keys       int64  `json:"keys"`
	MemoryUsed string `json:"memoryUsed"`
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

// SetNX stores a value only if the key does not exist
func (c *RedisCache) SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return false, fmt.Errorf("marshal cache value: %w", err)
	}
	return c.client.SetNX(ctx, key, data, ttl).Result()
}

// Delete removes a value from cache
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

// DeleteMulti removes multiple keys from cache
func (c *RedisCache) DeleteMulti(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	return c.client.Del(ctx, keys...).Err()
}

// DeleteByPattern removes all keys matching a pattern
func (c *RedisCache) DeleteByPattern(ctx context.Context, pattern string) (int64, error) {
	var cursor uint64
	var deleted int64

	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return deleted, fmt.Errorf("scan keys: %w", err)
		}

		if len(keys) > 0 {
			count, err := c.client.Del(ctx, keys...).Result()
			if err != nil {
				return deleted, fmt.Errorf("delete keys: %w", err)
			}
			deleted += count
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return deleted, nil
}

// Exists checks if a key exists in cache
func (c *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

// TTL returns the remaining time to live for a key
func (c *RedisCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.client.TTL(ctx, key).Result()
}

// Expire updates the TTL for a key
func (c *RedisCache) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return c.client.Expire(ctx, key, ttl).Err()
}

// GetStats returns cache statistics
func (c *RedisCache) GetStats(ctx context.Context) (*CacheStats, error) {
	info, err := c.client.Info(ctx, "stats", "memory", "keyspace").Result()
	if err != nil {
		return nil, fmt.Errorf("get redis info: %w", err)
	}

	// Parse basic stats
	stats := &CacheStats{}

	// Get keyspace hits/misses from INFO
	var hits, misses int64
	fmt.Sscanf(extractInfoValue(info, "keyspace_hits"), "%d", &hits)
	fmt.Sscanf(extractInfoValue(info, "keyspace_misses"), "%d", &misses)

	stats.Hits = hits
	stats.Misses = misses

	if hits+misses > 0 {
		hitRate := float64(hits) / float64(hits+misses) * 100
		stats.HitRate = fmt.Sprintf("%.2f%%", hitRate)
	} else {
		stats.HitRate = "N/A"
	}

	// Get memory usage
	stats.MemoryUsed = extractInfoValue(info, "used_memory_human")

	// Count keys with our prefix
	keys, err := c.client.Keys(ctx, "addr:*").Result()
	if err == nil {
		stats.Keys = int64(len(keys))
	}
	transferKeys, err := c.client.Keys(ctx, "transfers:*").Result()
	if err == nil {
		stats.Keys += int64(len(transferKeys))
	}
	statsKeys, err := c.client.Keys(ctx, "stats:*").Result()
	if err == nil {
		stats.Keys += int64(len(statsKeys))
	}

	return stats, nil
}

// extractInfoValue extracts a value from Redis INFO output
func extractInfoValue(info, key string) string {
	lines := splitLines(info)
	for _, line := range lines {
		if len(line) > len(key)+1 && line[:len(key)+1] == key+":" {
			return line[len(key)+1:]
		}
	}
	return ""
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, line)
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

// InvalidateAddress invalidates all cache entries for an address
func (c *RedisCache) InvalidateAddress(ctx context.Context, address, network string) error {
	patterns := []string{
		fmt.Sprintf("%s%s:%s", KeyPrefixAddress, network, address),
		fmt.Sprintf("%s%s:%s:*", KeyPrefixTransfers, network, address),
		fmt.Sprintf("%s%s:%s", KeyPrefixStats, network, address),
	}

	for _, pattern := range patterns {
		if _, err := c.DeleteByPattern(ctx, pattern); err != nil {
			return fmt.Errorf("invalidate pattern %s: %w", pattern, err)
		}
	}

	return nil
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

// AddressTransfersKeyWithFilter generates a cache key for filtered address transfers
func AddressTransfersKeyWithFilter(address, network, transferType string, page, pageSize int) string {
	if transferType == "" {
		return AddressTransfersKey(address, network, page, pageSize)
	}
	return fmt.Sprintf("%s%s:%s:%s:p%d:s%d", KeyPrefixTransfers, network, address, transferType, page, pageSize)
}

// AddressStatsKey generates a cache key for address stats
func AddressStatsKey(address, network string) string {
	return fmt.Sprintf("%s%s:%s", KeyPrefixStats, network, address)
}
