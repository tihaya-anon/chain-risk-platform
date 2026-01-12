// Package ratelimit provides rate limiting middleware for Gin
package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// Config holds rate limiter configuration
type Config struct {
	RequestsPerMinute int           // Max requests per minute per IP
	BurstSize         int           // Max burst size
	CleanupInterval   time.Duration // Interval to cleanup stale entries
	MaxEntries        int           // Max limiter entries before cleanup
}

// DefaultConfig returns default rate limit configuration
func DefaultConfig() Config {
	return Config{
		RequestsPerMinute: 60, // alerts API: 60/min
		BurstSize:         12,
		CleanupInterval:   5 * time.Minute,
		MaxEntries:        10000,
	}
}

// limiterEntry holds a rate limiter with last access time
type limiterEntry struct {
	limiter    *rate.Limiter
	lastAccess time.Time
}

// RateLimiter manages per-IP rate limiting
type RateLimiter struct {
	limiters sync.Map
	config   Config
	stopCh   chan struct{}
}

// New creates a new RateLimiter with default config
func New() *RateLimiter {
	return NewWithConfig(DefaultConfig())
}

// NewWithConfig creates a new RateLimiter with custom config
func NewWithConfig(cfg Config) *RateLimiter {
	rl := &RateLimiter{
		config: cfg,
		stopCh: make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// getLimiter returns or creates a rate limiter for the given key
func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	rps := rate.Limit(float64(rl.config.RequestsPerMinute) / 60.0)

	if entry, ok := rl.limiters.Load(key); ok {
		e := entry.(*limiterEntry)
		e.lastAccess = time.Now()
		return e.limiter
	}

	limiter := rate.NewLimiter(rps, rl.config.BurstSize)
	rl.limiters.Store(key, &limiterEntry{
		limiter:    limiter,
		lastAccess: time.Now(),
	})
	return limiter
}

// cleanupLoop periodically removes stale limiter entries
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.cleanup()
		case <-rl.stopCh:
			return
		}
	}
}

// cleanup removes entries not accessed within cleanup interval
func (rl *RateLimiter) cleanup() {
	threshold := time.Now().Add(-rl.config.CleanupInterval)
	rl.limiters.Range(func(key, value interface{}) bool {
		entry := value.(*limiterEntry)
		if entry.lastAccess.Before(threshold) {
			rl.limiters.Delete(key)
		}
		return true
	})
}

// Stop stops the cleanup goroutine
func (rl *RateLimiter) Stop() {
	close(rl.stopCh)
}

// Middleware returns a Gin middleware for per-IP rate limiting
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": "Too many requests. Please try again later.",
			})
			return
		}
		c.Next()
	}
}

// MiddlewareWithConfig returns a rate limiting middleware with custom config
func MiddlewareWithConfig(cfg Config) gin.HandlerFunc {
	rl := NewWithConfig(cfg)
	return rl.Middleware()
}

// PerIPMiddleware returns a simple per-IP rate limiter middleware
func PerIPMiddleware(requestsPerMinute int) gin.HandlerFunc {
	return MiddlewareWithConfig(Config{
		RequestsPerMinute: requestsPerMinute,
		BurstSize:         requestsPerMinute / 5,
		CleanupInterval:   5 * time.Minute,
		MaxEntries:        10000,
	})
}
