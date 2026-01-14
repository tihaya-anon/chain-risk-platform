package collector

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds Prometheus metrics for the collector
type Metrics struct {
	TxReceived       prometheus.Counter
	TxProcessed      prometheus.Counter
	TxFetchErrors    prometheus.Counter
	TxDropped        prometheus.Counter
	ConnectionStatus prometheus.Gauge
	KafkaProduced    prometheus.Counter
	KafkaErrors      prometheus.Counter
	ProcessingLag    prometheus.Histogram
}

// NewMetrics creates collector metrics
func NewMetrics(namespace string) *Metrics {
	return &Metrics{
		TxReceived: promauto.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "tx_received_total",
			Help:      "Total pending transactions received from mempool",
		}),
		TxProcessed: promauto.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "tx_processed_total",
			Help:      "Total pending transactions processed",
		}),
		TxFetchErrors: promauto.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "tx_fetch_errors_total",
			Help:      "Total errors fetching transaction details",
		}),
		TxDropped: promauto.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "tx_dropped_total",
			Help:      "Total transactions dropped due to buffer full",
		}),
		ConnectionStatus: promauto.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "connection_status",
			Help:      "WebSocket connection status (1=connected, 0=disconnected)",
		}),
		KafkaProduced: promauto.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "kafka_produced_total",
			Help:      "Total messages produced to Kafka",
		}),
		KafkaErrors: promauto.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "kafka_errors_total",
			Help:      "Total Kafka produce errors",
		}),
		ProcessingLag: promauto.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "processing_lag_ms",
			Help:      "Processing lag in milliseconds",
			Buckets:   []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
		}),
	}
}
