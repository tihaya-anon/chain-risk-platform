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

	// Alert-specific metrics
	AlertsTriggeredTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_alerts_triggered_total",
			Help: "Total alerts triggered",
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
		[]string{"channel", "status"}, // channel: webhook/email/slack, status: success/failed
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
		[]string{"rule_type", "result"}, // result: triggered/not_triggered/error
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
)

func init() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		AlertsTriggeredTotal,
		AlertsDeduplicatedTotal,
		NotificationsSentTotal,
		NotificationLatency,
		RuleEvaluationsTotal,
		RuleEvaluationDuration,
		KafkaMessagesConsumed,
		ActiveRulesGauge,
	)
}

// Handler returns the Prometheus metrics HTTP handler
func Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
