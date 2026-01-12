package circuitbreaker

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sony/gobreaker"
)

// State constants for metrics
const (
	StateClosed   = 0
	StateHalfOpen = 1
	StateOpen     = 2
)

var (
	cbStateGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "circuit_breaker_state",
			Help: "Circuit breaker state: 0=closed, 1=half-open, 2=open",
		},
		[]string{"name", "service"},
	)

	cbRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "circuit_breaker_requests_total",
			Help: "Total requests through circuit breaker",
		},
		[]string{"name", "service", "result"},
	)

	cbStateChangesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "circuit_breaker_state_changes_total",
			Help: "Total circuit breaker state changes",
		},
		[]string{"name", "service", "from", "to"},
	)
)

// Config holds circuit breaker configuration
type Config struct {
	Name                   string
	MaxRequests            uint32
	Interval               time.Duration
	Timeout                time.Duration
	ConsecutiveFailures    uint32
	FailureRatioThreshold  float64
	MinRequests            uint32
}

// DefaultConfig returns sensible defaults
func DefaultConfig(name string) Config {
	return Config{
		Name:                   name,
		MaxRequests:            3,
		Interval:               10 * time.Second,
		Timeout:                30 * time.Second,
		ConsecutiveFailures:    5,
		FailureRatioThreshold:  0.6,
		MinRequests:            10,
	}
}

// Manager manages multiple circuit breakers
type Manager struct {
	service  string
	breakers map[string]*gobreaker.CircuitBreaker
	mu       sync.RWMutex
}

// NewManager creates a circuit breaker manager
func NewManager(serviceName string) *Manager {
	return &Manager{
		service:  serviceName,
		breakers: make(map[string]*gobreaker.CircuitBreaker),
	}
}

// Get returns a circuit breaker by name, creating if needed
func (m *Manager) Get(name string) *gobreaker.CircuitBreaker {
	m.mu.RLock()
	cb, exists := m.breakers[name]
	m.mu.RUnlock()

	if exists {
		return cb
	}

	return m.Create(DefaultConfig(name))
}

// Create creates a new circuit breaker with custom config
func (m *Manager) Create(cfg Config) *gobreaker.CircuitBreaker {
	m.mu.Lock()
	defer m.mu.Unlock()

	if cb, exists := m.breakers[cfg.Name]; exists {
		return cb
	}

	settings := gobreaker.Settings{
		Name:        cfg.Name,
		MaxRequests: cfg.MaxRequests,
		Interval:    cfg.Interval,
		Timeout:     cfg.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Trip on consecutive failures
			if counts.ConsecutiveFailures >= cfg.ConsecutiveFailures {
				return true
			}
			// Trip on failure ratio with minimum requests
			if counts.Requests >= cfg.MinRequests {
				failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
				return failureRatio >= cfg.FailureRatioThreshold
			}
			return false
		},
		OnStateChange: func(name string, from, to gobreaker.State) {
			m.onStateChange(cfg.Name, from, to)
		},
	}

	cb := gobreaker.NewCircuitBreaker(settings)
	m.breakers[cfg.Name] = cb

	// Initialize metrics
	cbStateGauge.WithLabelValues(cfg.Name, m.service).Set(StateClosed)

	return cb
}

func (m *Manager) onStateChange(name string, from, to gobreaker.State) {
	// Update state metric
	var toValue float64
	switch to {
	case gobreaker.StateClosed:
		toValue = StateClosed
	case gobreaker.StateHalfOpen:
		toValue = StateHalfOpen
	case gobreaker.StateOpen:
		toValue = StateOpen
	}
	cbStateGauge.WithLabelValues(name, m.service).Set(toValue)

	// Count state changes
	cbStateChangesTotal.WithLabelValues(
		name,
		m.service,
		from.String(),
		to.String(),
	).Inc()
}

// Execute runs a function through the circuit breaker
func (m *Manager) Execute(name string, fn func() (interface{}, error)) (interface{}, error) {
	cb := m.Get(name)

	result, err := cb.Execute(fn)

	// Record metrics
	if err != nil {
		if err == gobreaker.ErrOpenState || err == gobreaker.ErrTooManyRequests {
			cbRequestsTotal.WithLabelValues(name, m.service, "rejected").Inc()
		} else {
			cbRequestsTotal.WithLabelValues(name, m.service, "failure").Inc()
		}
	} else {
		cbRequestsTotal.WithLabelValues(name, m.service, "success").Inc()
	}

	return result, err
}

// State returns the current state of a circuit breaker
func (m *Manager) State(name string) gobreaker.State {
	cb := m.Get(name)
	return cb.State()
}

// IsOpen returns true if circuit is open (failing)
func (m *Manager) IsOpen(name string) bool {
	return m.State(name) == gobreaker.StateOpen
}

// Counts returns current counts for a circuit breaker
func (m *Manager) Counts(name string) gobreaker.Counts {
	cb := m.Get(name)
	return cb.Counts()
}
