package circuitbreaker

import (
	"context"
	"errors"

	"github.com/sony/gobreaker"
)

// Common errors
var (
	ErrCircuitOpen     = errors.New("circuit breaker is open")
	ErrTooManyRequests = errors.New("too many requests to half-open circuit")
)

// WrapError converts gobreaker errors to more descriptive errors
func WrapError(err error) error {
	if err == nil {
		return nil
	}
	switch err {
	case gobreaker.ErrOpenState:
		return ErrCircuitOpen
	case gobreaker.ErrTooManyRequests:
		return ErrTooManyRequests
	default:
		return err
	}
}

// IsCircuitError returns true if error is circuit breaker related
func IsCircuitError(err error) bool {
	return errors.Is(err, ErrCircuitOpen) ||
		errors.Is(err, ErrTooManyRequests) ||
		err == gobreaker.ErrOpenState ||
		err == gobreaker.ErrTooManyRequests
}

// ExecuteWithFallback executes function with fallback on circuit open
func (m *Manager) ExecuteWithFallback(
	ctx context.Context,
	name string,
	fn func() (interface{}, error),
	fallback func() (interface{}, error),
) (interface{}, error) {
	result, err := m.Execute(name, fn)

	if IsCircuitError(err) && fallback != nil {
		return fallback()
	}

	return result, err
}

// KafkaConfig returns config optimized for Kafka producer
func KafkaConfig(name string) Config {
	return Config{
		Name:                   name,
		MaxRequests:            5,
		Interval:               15 * Second,
		Timeout:                45 * Second,
		ConsecutiveFailures:    10,
		FailureRatioThreshold:  0.5,
		MinRequests:            20,
	}
}

// NotificationConfig returns config for notification services
func NotificationConfig(name string) Config {
	return Config{
		Name:                   name,
		MaxRequests:            3,
		Interval:               10 * Second,
		Timeout:                30 * Second,
		ConsecutiveFailures:    5,
		FailureRatioThreshold:  0.4,
		MinRequests:            10,
	}
}

// DBConfig returns config optimized for database connections
func DBConfig(name string) Config {
	return Config{
		Name:                   name,
		MaxRequests:            3,
		Interval:               10 * Second,
		Timeout:                30 * Second,
		ConsecutiveFailures:    5,
		FailureRatioThreshold:  0.5,
		MinRequests:            5,
	}
}

// Second is a time.Second constant for config convenience
const Second = 1000000000 // nanoseconds
