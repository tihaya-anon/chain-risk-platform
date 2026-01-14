package collector

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

func TestNewMetrics(t *testing.T) {
	// Unregister any existing metrics first
	namespace := "test_mempool_collector"
	metrics := NewMetrics(namespace)

	if metrics == nil {
		t.Fatal("NewMetrics returned nil")
	}

	// Verify all metrics are initialized
	if metrics.TxReceived == nil {
		t.Error("TxReceived is nil")
	}
	if metrics.TxProcessed == nil {
		t.Error("TxProcessed is nil")
	}
	if metrics.TxFetchErrors == nil {
		t.Error("TxFetchErrors is nil")
	}
	if metrics.TxDropped == nil {
		t.Error("TxDropped is nil")
	}
	if metrics.ConnectionStatus == nil {
		t.Error("ConnectionStatus is nil")
	}
	if metrics.KafkaProduced == nil {
		t.Error("KafkaProduced is nil")
	}
	if metrics.KafkaErrors == nil {
		t.Error("KafkaErrors is nil")
	}
	if metrics.ProcessingLag == nil {
		t.Error("ProcessingLag is nil")
	}
}

func TestMetrics_Operations(t *testing.T) {
	// Create metrics with unique namespace to avoid registration conflicts
	reg := prometheus.NewRegistry()
	
	txReceived := prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "test_ops",
		Name:      "tx_received_total",
	})
	connectionStatus := prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: "test_ops",
		Name:      "connection_status",
	})
	processingLag := prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: "test_ops",
		Name:      "processing_lag_ms",
		Buckets:   []float64{1, 5, 10},
	})

	reg.MustRegister(txReceived, connectionStatus, processingLag)

	// Test counter increment
	txReceived.Inc()
	txReceived.Inc()

	// Test gauge set
	connectionStatus.Set(1)
	connectionStatus.Set(0)

	// Test histogram observation
	processingLag.Observe(5.0)
	processingLag.Observe(15.0)
}
