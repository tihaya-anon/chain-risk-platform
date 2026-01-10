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

	// Business metrics - Transfer query duration (CP-5)
	TransferQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_transfers_duration_seconds",
			Help:    "Duration of transfer query operations",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
		},
		[]string{"operation"}, // list, by_id, by_hash, by_address
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

	// Transfer result metrics
	TransferResultCount = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_service_transfer_result_count",
			Help:    "Number of transfers returned per query",
			Buckets: []float64{0, 1, 5, 10, 20, 50, 100, 200, 500},
		},
		[]string{"operation"},
	)
)

func init() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		TransferQueryDuration,
		TransferQueriesTotal,
		AddressQueriesTotal,
		CacheHitsTotal,
		DBQueryDuration,
		TransferResultCount,
	)
}

// Handler returns the Prometheus metrics HTTP handler
func Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// ObserveTransferQuery records a transfer query duration
func ObserveTransferQuery(operation string, durationSeconds float64, resultCount int) {
	TransferQueryDuration.WithLabelValues(operation).Observe(durationSeconds)
	TransferResultCount.WithLabelValues(operation).Observe(float64(resultCount))
	TransferQueriesTotal.WithLabelValues(operation).Inc()
}
