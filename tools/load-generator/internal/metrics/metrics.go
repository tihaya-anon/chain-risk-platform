package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	RequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "loadgen_requests_total",
			Help: "Total requests sent",
		},
		[]string{"service", "endpoint", "status"},
	)

	RequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "loadgen_request_duration_seconds",
			Help:    "Request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "endpoint"},
	)

	RequestsInFlight = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "loadgen_requests_in_flight",
			Help: "Number of requests currently in flight",
		},
		[]string{"service"},
	)

	TargetRPS = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "loadgen_target_rps",
			Help: "Target RPS for each workload",
		},
		[]string{"service", "endpoint"},
	)

	ActualRPS = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "loadgen_actual_rps",
			Help: "Actual achieved RPS",
		},
		[]string{"service", "endpoint"},
	)

	ErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "loadgen_errors_total",
			Help: "Total errors by type",
		},
		[]string{"service", "endpoint", "error_type"},
	)

	Concurrency = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "loadgen_concurrency",
			Help: "Current concurrency (in-flight requests)",
		},
		[]string{"service"},
	)

	Throughput = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "loadgen_throughput",
			Help: "Current throughput (successful requests/sec)",
		},
		[]string{"service"},
	)
)

func Init() {
	prometheus.MustRegister(
		RequestsTotal,
		RequestDuration,
		RequestsInFlight,
		TargetRPS,
		ActualRPS,
		ErrorsTotal,
		Concurrency,
		Throughput,
	)
}

// RecordRequest records a completed request.
func RecordRequest(service, endpoint string, status string, durationSec float64) {
	RequestsTotal.WithLabelValues(service, endpoint, status).Inc()
	RequestDuration.WithLabelValues(service, endpoint).Observe(durationSec)
}

// RecordError records an error.
func RecordError(service, endpoint, errorType string) {
	ErrorsTotal.WithLabelValues(service, endpoint, errorType).Inc()
}

// UpdateTargetRPS updates the target RPS gauge.
func UpdateTargetRPS(service, endpoint string, rps float64) {
	TargetRPS.WithLabelValues(service, endpoint).Set(rps)
}

// UpdateActualRPS updates the actual achieved RPS gauge.
func UpdateActualRPS(service, endpoint string, rps float64) {
	ActualRPS.WithLabelValues(service, endpoint).Set(rps)
}

// IncInFlight increments in-flight counter.
func IncInFlight(service string) {
	RequestsInFlight.WithLabelValues(service).Inc()
	Concurrency.WithLabelValues(service).Inc()
}

// DecInFlight decrements in-flight counter.
func DecInFlight(service string) {
	RequestsInFlight.WithLabelValues(service).Dec()
	Concurrency.WithLabelValues(service).Dec()
}
