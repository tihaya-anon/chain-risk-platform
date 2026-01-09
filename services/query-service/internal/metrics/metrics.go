package metrics

import (
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_service_http_request_duration_seconds",
			Help:    "HTTP request latency",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// Service-specific metrics
	TransferQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_transfer_queries_total",
			Help: "Total transfer queries",
		},
		[]string{"type"}, // by_address, by_hash, etc.
	)

	AddressQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_address_queries_total",
			Help: "Total address queries",
		},
		[]string{"type"}, // info, tags, etc.
	)

	CacheHitsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_cache_hits_total",
			Help: "Cache hit/miss counts",
		},
		[]string{"result"}, // hit, miss
	)

	DBQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_service_db_query_duration_seconds",
			Help:    "Database query latency",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"query_type"},
	)
)

func init() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		TransferQueriesTotal,
		AddressQueriesTotal,
		CacheHitsTotal,
		DBQueryDuration,
	)
}

// Handler returns the Prometheus metrics HTTP handler
func Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
