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

	// Business metrics - Alerts triggered with severity (CP-5)
	AlertsTriggeredTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alerts_triggered_total",
			Help: "Total alerts triggered by severity",
		},
		[]string{"severity"}, // critical, high, medium, low
	)

	// Additional alert metrics with more detail
	AlertsTriggeredByRule = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alert_service_alerts_triggered_by_rule_total",
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

	// Alert severity distribution gauge
	AlertsBySeverityGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "alert_service_alerts_by_severity",
			Help: "Current count of alerts by severity in the last hour",
		},
		[]string{"severity"},
	)
)

func init() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		AlertsTriggeredTotal,
		AlertsTriggeredByRule,
		AlertsDeduplicatedTotal,
		NotificationsSentTotal,
		NotificationLatency,
		RuleEvaluationsTotal,
		RuleEvaluationDuration,
		KafkaMessagesConsumed,
		ActiveRulesGauge,
		AlertsBySeverityGauge,
	)
}

// Handler returns the Prometheus metrics HTTP handler
func Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// RecordAlertTriggered records an alert being triggered
func RecordAlertTriggered(ruleType, severity string) {
	// Business metric (CP-5)
	AlertsTriggeredTotal.WithLabelValues(severity).Inc()
	// Detailed metric
	AlertsTriggeredByRule.WithLabelValues(ruleType, severity).Inc()
}

// RecordRuleEvaluation records a rule evaluation
func RecordRuleEvaluation(ruleType string, triggered bool, durationSeconds float64) {
	result := "not_triggered"
	if triggered {
		result = "triggered"
	}
	RuleEvaluationsTotal.WithLabelValues(ruleType, result).Inc()
	RuleEvaluationDuration.WithLabelValues(ruleType).Observe(durationSeconds)
}

// RecordNotification records a notification being sent
func RecordNotification(channel string, success bool, latencySeconds float64) {
	status := "success"
	if !success {
		status = "failed"
	}
	NotificationsSentTotal.WithLabelValues(channel, status).Inc()
	NotificationLatency.WithLabelValues(channel).Observe(latencySeconds)
}
