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

var (
	// ============== HTTP Metrics ==============
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "alert_service_http_request_duration_seconds",
			Help:    "HTTP request latency",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// ============== USE: Utilization ==============
	CPUUtilizationRatio = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_cpu_utilization_ratio",
			Help: "CPU utilization ratio (0-1)",
		},
	)

	MemoryUtilizationRatio = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_memory_utilization_ratio",
			Help: "Memory utilization ratio (0-1)",
		},
	)

	GoroutinesCount = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_goroutines_count",
			Help: "Number of active goroutines",
		},
	)

	ActiveRequests = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_active_requests",
			Help: "Number of currently processing requests",
		},
	)

	DBConnectionPoolUtilization = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_db_connection_pool_utilization",
			Help: "Database connection pool utilization",
		},
	)

	KafkaConsumerLag = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "alert_service_kafka_consumer_lag",
			Help: "Kafka consumer lag by topic/partition",
		},
		[]string{"topic", "partition"},
	)

	// ============== USE: Saturation ==============
	DBConnectionWaitTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "alert_service_db_connection_wait_total",
			Help: "Total requests that waited for DB connection",
		},
	)

	RateLimitExceededTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "alert_service_rate_limit_exceeded_total",
			Help: "Total requests rejected by rate limiter",
		},
	)

	NotificationQueueLength = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_notification_queue_length",
			Help: "Number of notifications waiting to be sent",
		},
	)

	RuleEvaluationQueueLength = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_rule_evaluation_queue_length",
			Help: "Number of events waiting for rule evaluation",
		},
	)

	// ============== USE: Errors ==============
	ErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_errors_total",
			Help: "Total errors by type",
		},
		[]string{"type"},
	)

	CircuitBreakerState = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "alert_service_circuit_breaker_state",
			Help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
		},
		[]string{"target"},
	)

	// ============== Business Metrics ==============
	AlertsTriggeredTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alerts_triggered_total",
			Help: "Total alerts triggered by rule type and severity",
		},
		[]string{"rule_type", "severity"},
	)

	AlertsDeduplicatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "alert_service_alerts_deduplicated_total",
			Help: "Total alerts deduplicated",
		},
	)

	NotificationsSentTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_notifications_sent_total",
			Help: "Total notifications sent",
		},
		[]string{"channel", "status"},
	)

	NotificationLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "alert_service_notification_latency_seconds",
			Help:    "Notification delivery latency",
			Buckets: []float64{.01, .05, .1, .25, .5, 1, 2.5, 5, 10},
		},
		[]string{"channel"},
	)

	RuleEvaluationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_rule_evaluations_total",
			Help: "Total rule evaluations",
		},
		[]string{"rule_type", "result"},
	)

	RuleEvaluationDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "alert_service_rule_evaluation_duration_seconds",
			Help:    "Rule evaluation latency",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25},
		},
		[]string{"rule_type"},
	)

	KafkaMessagesConsumed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_kafka_messages_consumed_total",
			Help: "Total Kafka messages consumed",
		},
		[]string{"topic"},
	)

	ActiveRulesGauge = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "alert_service_active_rules",
			Help: "Number of active alert rules",
		},
	)

	AlertsBySeverityGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "alert_service_alerts_by_severity",
			Help: "Current count of alerts by severity",
		},
		[]string{"severity"},
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
		KafkaConsumerLag,
		// USE: Saturation
		DBConnectionWaitTotal,
		RateLimitExceededTotal,
		NotificationQueueLength,
		RuleEvaluationQueueLength,
		// USE: Errors
		ErrorsTotal,
		CircuitBreakerState,
		// Business
		AlertsTriggeredTotal,
		AlertsDeduplicatedTotal,
		NotificationsSentTotal,
		NotificationLatency,
		RuleEvaluationsTotal,
		RuleEvaluationDuration,
		KafkaMessagesConsumed,
		ActiveRulesGauge,
		AlertsBySeverityGauge,
	)

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
	if total > 0 {
		DBConnectionPoolUtilization.Set(float64(used) / float64(total))
	}
}

// RecordKafkaLag records Kafka consumer lag
func RecordKafkaLag(topic, partition string, lag int64) {
	KafkaConsumerLag.WithLabelValues(topic, partition).Set(float64(lag))
}

// RecordError records an error by type
func RecordError(errorType string) {
	ErrorsTotal.WithLabelValues(errorType).Inc()
}

// SetCircuitBreakerState sets circuit breaker state
func SetCircuitBreakerState(target string, state int) {
	CircuitBreakerState.WithLabelValues(target).Set(float64(state))
}

// collectRuntimeMetrics periodically collects Go runtime metrics
func collectRuntimeMetrics() {
	var memStats runtime.MemStats
	memLimit := uint64(512 * 1024 * 1024) // Default 512MB

	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		GoroutinesCount.Set(float64(runtime.NumGoroutine()))

		runtime.ReadMemStats(&memStats)
		MemoryUtilizationRatio.Set(float64(memStats.Alloc) / float64(memLimit))
	}
}
