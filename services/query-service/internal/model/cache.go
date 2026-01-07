package model

import "github.com/0ksks/chain-risk-platform/query-service/pkg/cache"

// CacheStatsResponse represents cache statistics response
type CacheStatsResponse struct {
	Enabled bool              `json:"enabled"`
	Message string            `json:"message,omitempty"`
	Stats   *cache.CacheStats `json:"stats,omitempty"`
}

// InvalidateCacheResponse represents the response for cache invalidation
type InvalidateCacheResponse struct {
	Message string `json:"message"`
	Address string `json:"address,omitempty"`
	Network string `json:"network,omitempty"`
}
