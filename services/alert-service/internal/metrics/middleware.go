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

// RecordAlertTriggered records when an alert is triggered
func RecordAlertTriggered(ruleType, severity string) {
	AlertsTriggeredTotal.WithLabelValues(ruleType, severity).Inc()
}

// RecordAlertDeduplicated records when an alert is deduplicated
func RecordAlertDeduplicated() {
	AlertsDeduplicatedTotal.Inc()
}

// RecordNotification records notification send result
func RecordNotification(channel string, success bool, duration time.Duration) {
	status := "success"
	if !success {
		status = "failed"
	}
	NotificationsSentTotal.WithLabelValues(channel, status).Inc()
	NotificationLatency.WithLabelValues(channel).Observe(duration.Seconds())
}

// RecordRuleEvaluation records rule evaluation metrics
func RecordRuleEvaluation(ruleType string, triggered bool, err error, duration time.Duration) {
	result := "not_triggered"
	if err != nil {
		result = "error"
	} else if triggered {
		result = "triggered"
	}
	RuleEvaluationsTotal.WithLabelValues(ruleType, result).Inc()
	RuleEvaluationDuration.WithLabelValues(ruleType).Observe(duration.Seconds())
}

// RecordKafkaMessage records Kafka message consumption
func RecordKafkaMessage(topic string) {
	KafkaMessagesConsumed.WithLabelValues(topic).Inc()
}

// SetActiveRules sets the gauge for active rules count
func SetActiveRules(count int) {
	ActiveRulesGauge.Set(float64(count))
}
