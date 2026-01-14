package metrics

import (
	"runtime"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// USE Method: Utilization, Saturation, Errors
// Reference: https://www.brendangregg.com/usemethod.html

var (
	// ============== HTTP Metrics ==============
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

	// ============== USE: Utilization ==============
	CPUUtilizationRatio = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_cpu_utilization_ratio",
			Help: "CPU utilization ratio (0-1)",
		},
	)

	MemoryUtilizationRatio = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_memory_utilization_ratio",
			Help: "Memory utilization ratio (0-1)",
		},
	)

	GoroutinesCount = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_goroutines_count",
			Help: "Number of active goroutines",
		},
	)

	ActiveRequests = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_active_requests",
			Help: "Number of currently processing requests (for Little's Law)",
		},
	)

	DBConnectionPoolUtilization = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_db_connection_pool_utilization",
			Help: "Database connection pool utilization (used/total)",
		},
	)

	DBConnectionPoolUsed = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_db_connection_pool_used",
			Help: "Number of database connections in use",
		},
	)

	DBConnectionPoolTotal = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_db_connection_pool_total",
			Help: "Total database connection pool size",
		},
	)

	RedisConnectionPoolUtilization = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_redis_connection_pool_utilization",
			Help: "Redis connection pool utilization",
		},
	)

	// ============== USE: Saturation ==============
	DBConnectionWaitTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "query_service_db_connection_wait_total",
			Help: "Total requests that waited for a DB connection",
		},
	)

	DBConnectionWaitDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "query_service_db_connection_wait_seconds",
			Help:    "Time spent waiting for DB connection",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
	)

	RateLimitExceededTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "query_service_rate_limit_exceeded_total",
			Help: "Total requests rejected by rate limiter",
		},
	)

	RequestQueueLength = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "query_service_request_queue_length",
			Help: "Number of requests waiting in queue",
		},
	)

	// ============== USE: Errors ==============
	ErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_errors_total",
			Help: "Total errors by type",
		},
		[]string{"type"}, // db_error, cache_error, timeout, validation
	)

	CircuitBreakerState = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "query_service_circuit_breaker_state",
			Help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
		},
		[]string{"target"},
	)

	// ============== Business Metrics ==============
	TransferQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_transfer_queries_total",
			Help: "Total transfer queries",
		},
		[]string{"type"},
	)

	AddressQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_address_queries_total",
			Help: "Total address queries",
		},
		[]string{"type"},
	)

	CacheHitsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "query_service_cache_hits_total",
			Help: "Cache hit/miss counts",
		},
		[]string{"result"},
	)

	DBQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_service_db_query_duration_seconds",
			Help:    "Database query latency",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"query_type"},
	)

	TransferQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_transfers_duration_seconds",
			Help:    "Duration of transfer query operations",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
		},
		[]string{"operation"},
	)

	TransferResultCount = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "query_service_transfer_result_count",
			Help:    "Number of transfers returned per query",
			Buckets: []float64{0, 1, 5, 10, 20, 50, 100, 200, 500},
		},
		[]string{"operation"},
	)
)

var activeRequestCount int64

func init() {
	prometheus.MustRegister(
		// HTTP
		HTTPRequestsTotal,
		HTTPRequestDuration,
		// USE: Utilization
		CPUUtilizationRatio,
		MemoryUtilizationRatio,
		GoroutinesCount,
		ActiveRequests,
		DBConnectionPoolUtilization,
		DBConnectionPoolUsed,
		DBConnectionPoolTotal,
		RedisConnectionPoolUtilization,
		// USE: Saturation
		DBConnectionWaitTotal,
		DBConnectionWaitDuration,
		RateLimitExceededTotal,
		RequestQueueLength,
		// USE: Errors
		ErrorsTotal,
		CircuitBreakerState,
		// Business
		TransferQueriesTotal,
		AddressQueriesTotal,
		CacheHitsTotal,
		DBQueryDuration,
		TransferQueryDuration,
		TransferResultCount,
	)

	// Start background metrics collector
	go collectRuntimeMetrics()
}

// Handler returns the Prometheus metrics HTTP handler
func Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// IncActiveRequests increments active request count
func IncActiveRequests() {
	atomic.AddInt64(&activeRequestCount, 1)
	ActiveRequests.Set(float64(atomic.LoadInt64(&activeRequestCount)))
}

// DecActiveRequests decrements active request count
func DecActiveRequests() {
	atomic.AddInt64(&activeRequestCount, -1)
	ActiveRequests.Set(float64(atomic.LoadInt64(&activeRequestCount)))
}

// RecordDBPoolStats records database connection pool metrics
func RecordDBPoolStats(used, total int) {
	DBConnectionPoolUsed.Set(float64(used))
	DBConnectionPoolTotal.Set(float64(total))
	if total > 0 {
		DBConnectionPoolUtilization.Set(float64(used) / float64(total))
	}
}

// RecordRedisPoolStats records Redis connection pool metrics
func RecordRedisPoolStats(used, total int) {
	if total > 0 {
		RedisConnectionPoolUtilization.Set(float64(used) / float64(total))
	}
}

// RecordDBWait records time spent waiting for DB connection
func RecordDBWait(duration time.Duration) {
	DBConnectionWaitTotal.Inc()
	DBConnectionWaitDuration.Observe(duration.Seconds())
}

// RecordError records an error by type
func RecordError(errorType string) {
	ErrorsTotal.WithLabelValues(errorType).Inc()
}

// SetCircuitBreakerState sets circuit breaker state for a target
func SetCircuitBreakerState(target string, state int) {
	CircuitBreakerState.WithLabelValues(target).Set(float64(state))
}

// ObserveTransferQuery records a transfer query duration
func ObserveTransferQuery(operation string, durationSeconds float64, resultCount int) {
	TransferQueryDuration.WithLabelValues(operation).Observe(durationSeconds)
	TransferResultCount.WithLabelValues(operation).Observe(float64(resultCount))
	TransferQueriesTotal.WithLabelValues(operation).Inc()
}

// collectRuntimeMetrics periodically collects Go runtime metrics
func collectRuntimeMetrics() {
	var memStats runtime.MemStats
	memLimit := getMemoryLimit()

	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		// Goroutines
		GoroutinesCount.Set(float64(runtime.NumGoroutine()))

		// Memory utilization
		runtime.ReadMemStats(&memStats)
		if memLimit > 0 {
			MemoryUtilizationRatio.Set(float64(memStats.Alloc) / float64(memLimit))
		}
	}
}

// getMemoryLimit returns memory limit (from cgroups or GOMEMLIMIT)
func getMemoryLimit() uint64 {
	// Default to 512MB if not set
	return 512 * 1024 * 1024
}
