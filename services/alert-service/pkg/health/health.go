package health

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Status represents health check status
type Status string

const (
	StatusUp   Status = "up"
	StatusDown Status = "down"
)

// CheckFunc is a function that performs a health check
type CheckFunc func(ctx context.Context) error

// Check represents a single health check
type Check struct {
	Name    string
	Check   CheckFunc
	Timeout time.Duration
}

// CheckResult represents the result of a health check
type CheckResult struct {
	Name   string `json:"name"`
	Status Status `json:"status"`
	Error  string `json:"error,omitempty"`
}

// Response represents the health check response
type Response struct {
	Status  Status                 `json:"status"`
	Checks  map[string]CheckResult `json:"checks,omitempty"`
	Details map[string]any         `json:"details,omitempty"`
}

// Checker manages health checks
type Checker struct {
	mu       sync.RWMutex
	checks   []Check
	details  map[string]any
	ready    bool
	readyMu  sync.RWMutex
}

// NewChecker creates a new health checker
func NewChecker() *Checker {
	return &Checker{
		checks:  make([]Check, 0),
		details: make(map[string]any),
		ready:   false,
	}
}

// AddCheck adds a health check
func (c *Checker) AddCheck(name string, check CheckFunc, timeout time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.checks = append(c.checks, Check{
		Name:    name,
		Check:   check,
		Timeout: timeout,
	})
}

// SetDetail sets a detail value
func (c *Checker) SetDetail(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.details[key] = value
}

// SetReady sets the readiness state
func (c *Checker) SetReady(ready bool) {
	c.readyMu.Lock()
	defer c.readyMu.Unlock()
	c.ready = ready
}

// IsReady returns the readiness state
func (c *Checker) IsReady() bool {
	c.readyMu.RLock()
	defer c.readyMu.RUnlock()
	return c.ready
}

// RunChecks executes all health checks
func (c *Checker) RunChecks(ctx context.Context) Response {
	c.mu.RLock()
	checks := make([]Check, len(c.checks))
	copy(checks, c.checks)
	details := make(map[string]any)
	for k, v := range c.details {
		details[k] = v
	}
	c.mu.RUnlock()

	results := make(map[string]CheckResult)
	overallStatus := StatusUp

	var wg sync.WaitGroup
	resultsCh := make(chan CheckResult, len(checks))

	for _, check := range checks {
		wg.Add(1)
		go func(ch Check) {
			defer wg.Done()

			timeout := ch.Timeout
			if timeout == 0 {
				timeout = 5 * time.Second
			}

			checkCtx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()

			result := CheckResult{
				Name:   ch.Name,
				Status: StatusUp,
			}

			if err := ch.Check(checkCtx); err != nil {
				result.Status = StatusDown
				result.Error = err.Error()
			}

			resultsCh <- result
		}(check)
	}

	wg.Wait()
	close(resultsCh)

	for result := range resultsCh {
		results[result.Name] = result
		if result.Status == StatusDown {
			overallStatus = StatusDown
		}
	}

	return Response{
		Status:  overallStatus,
		Checks:  results,
		Details: details,
	}
}

// LivenessHandler returns the liveness probe handler
func (c *Checker) LivenessHandler() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"status": "alive",
		})
	}
}

// ReadinessHandler returns the readiness probe handler
func (c *Checker) ReadinessHandler() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if !c.IsReady() {
			ctx.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "not_ready",
			})
			return
		}

		response := c.RunChecks(ctx.Request.Context())

		status := http.StatusOK
		if response.Status == StatusDown {
			status = http.StatusServiceUnavailable
		}

		ctx.JSON(status, response)
	}
}

// HealthHandler returns the combined health handler
func (c *Checker) HealthHandler() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		response := c.RunChecks(ctx.Request.Context())

		status := http.StatusOK
		if response.Status == StatusDown {
			status = http.StatusServiceUnavailable
		}

		ctx.JSON(status, response)
	}
}

// RegisterRoutes registers health check routes
func (c *Checker) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", c.HealthHandler())
	router.GET("/health/live", c.LivenessHandler())
	router.GET("/health/ready", c.ReadinessHandler())
}
