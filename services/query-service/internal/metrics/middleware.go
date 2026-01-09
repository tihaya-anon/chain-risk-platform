package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Middleware records HTTP request metrics
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = "unknown"
		}
		method := c.Request.Method

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
		HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
	}
}

// RecordTransferQuery records a transfer query metric
func RecordTransferQuery(queryType string) {
	TransferQueriesTotal.WithLabelValues(queryType).Inc()
}

// RecordAddressQuery records an address query metric
func RecordAddressQuery(queryType string) {
	AddressQueriesTotal.WithLabelValues(queryType).Inc()
}

// RecordCacheResult records cache hit/miss
func RecordCacheResult(hit bool) {
	result := "miss"
	if hit {
		result = "hit"
	}
	CacheHitsTotal.WithLabelValues(result).Inc()
}

// RecordDBQuery records database query duration
func RecordDBQuery(queryType string, duration time.Duration) {
	DBQueryDuration.WithLabelValues(queryType).Observe(duration.Seconds())
}
