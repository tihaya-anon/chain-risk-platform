package generator

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/chainrisk/load-generator/internal/config"
	"github.com/chainrisk/load-generator/internal/metrics"
	"github.com/chainrisk/load-generator/internal/pattern"
)

// Generator manages load generation for a scenario.
type Generator struct {
	scenario   *config.Scenario
	httpClient *http.Client
	wg         sync.WaitGroup
	cancel     context.CancelFunc
	ctx        context.Context

	// Statistics
	totalRequests   int64
	successRequests int64
	failedRequests  int64
	totalLatencyMs  int64
	startTime       time.Time
}

// New creates a new load generator.
func New(scenario *config.Scenario) *Generator {
	ctx, cancel := context.WithCancel(context.Background())

	transport := &http.Transport{
		MaxIdleConnsPerHost: 100,
		MaxConnsPerHost:     100,
		IdleConnTimeout:     90 * time.Second,
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: true},
	}

	return &Generator{
		scenario: scenario,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   30 * time.Second,
		},
		ctx:    ctx,
		cancel: cancel,
	}
}

// Run executes the scenario.
func (g *Generator) Run() error {
	g.startTime = time.Now()

	for _, workload := range g.scenario.Workloads {
		g.wg.Add(1)
		go g.runWorkload(workload)
	}

	// Wait for scenario duration
	timer := time.NewTimer(g.scenario.Duration)
	select {
	case <-timer.C:
		g.cancel()
	case <-g.ctx.Done():
	}

	g.wg.Wait()
	return nil
}

// Stop stops the generator.
func (g *Generator) Stop() {
	g.cancel()
}

func (g *Generator) runWorkload(workload config.Workload) {
	defer g.wg.Done()

	// Create pattern
	p := pattern.NewPattern(
		workload.Pattern,
		workload.RPS,
		workload.RPSStart,
		workload.RPSEnd,
		workload.StepDuration,
		workload.SpikeAt,
		workload.SpikeDuration,
		workload.SpikeMultiplier,
		g.scenario.Duration,
	)

	baseURL := config.GetServiceURL(workload.Service)
	url := baseURL + workload.Endpoint

	ticker := time.NewTicker(100 * time.Millisecond) // Adjust rate 10 times/sec
	defer ticker.Stop()

	var requestsThisSecond float64
	lastSecond := time.Now()

	for {
		select {
		case <-g.ctx.Done():
			return
		case now := <-ticker.C:
			elapsed := now.Sub(g.startTime)
			targetRPS := p.GetRPS(elapsed)

			metrics.UpdateTargetRPS(workload.Service, workload.Endpoint, targetRPS)

			// Reset counter every second
			if now.Sub(lastSecond) >= time.Second {
				metrics.UpdateActualRPS(workload.Service, workload.Endpoint, requestsThisSecond)
				requestsThisSecond = 0
				lastSecond = now
			}

			// Calculate requests to send in this tick (100ms)
			requestsToSend := int(targetRPS / 10)
			if requestsToSend < 1 && targetRPS > 0 {
				requestsToSend = 1
			}

			for i := 0; i < requestsToSend; i++ {
				g.wg.Add(1)
				go func() {
					defer g.wg.Done()
					g.sendRequest(workload, url)
					requestsThisSecond++
				}()
			}
		}
	}
}

func (g *Generator) sendRequest(workload config.Workload, url string) {
	metrics.IncInFlight(workload.Service)
	defer metrics.DecInFlight(workload.Service)

	atomic.AddInt64(&g.totalRequests, 1)

	start := time.Now()

	ctx, cancel := context.WithTimeout(g.ctx, workload.Timeout)
	defer cancel()

	var body io.Reader
	if workload.Body != "" {
		bodyStr := workload.Body
		for k, v := range workload.BodyParams {
			bodyStr = strings.ReplaceAll(bodyStr, "{{"+k+"}}", v)
		}
		body = bytes.NewBufferString(bodyStr)
	}

	req, err := http.NewRequestWithContext(ctx, workload.Method, url, body)
	if err != nil {
		metrics.RecordError(workload.Service, workload.Endpoint, "request_create")
		atomic.AddInt64(&g.failedRequests, 1)
		return
	}

	// Set headers
	for k, v := range workload.Headers {
		req.Header.Set(k, v)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := g.httpClient.Do(req)
	duration := time.Since(start)
	durationSec := duration.Seconds()
	atomic.AddInt64(&g.totalLatencyMs, duration.Milliseconds())

	if err != nil {
		metrics.RecordError(workload.Service, workload.Endpoint, "request_failed")
		metrics.RecordRequest(workload.Service, workload.Endpoint, "error", durationSec)
		atomic.AddInt64(&g.failedRequests, 1)
		return
	}
	defer resp.Body.Close()

	// Drain body
	io.Copy(io.Discard, resp.Body)

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RecordRequest(workload.Service, workload.Endpoint, status, durationSec)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		atomic.AddInt64(&g.successRequests, 1)
	} else {
		atomic.AddInt64(&g.failedRequests, 1)
	}
}

// PrintSummary prints a summary of the test results.
func (g *Generator) PrintSummary() {
	duration := time.Since(g.startTime)
	total := atomic.LoadInt64(&g.totalRequests)
	success := atomic.LoadInt64(&g.successRequests)
	failed := atomic.LoadInt64(&g.failedRequests)
	totalLatency := atomic.LoadInt64(&g.totalLatencyMs)

	avgLatency := float64(0)
	if total > 0 {
		avgLatency = float64(totalLatency) / float64(total)
	}

	fmt.Println("\n========== Test Summary ==========")
	fmt.Printf("Scenario: %s\n", g.scenario.Name)
	fmt.Printf("Duration: %v\n", duration.Round(time.Second))
	fmt.Printf("Total Requests: %d\n", total)
	fmt.Printf("Successful: %d (%.2f%%)\n", success, float64(success)/float64(total)*100)
	fmt.Printf("Failed: %d (%.2f%%)\n", failed, float64(failed)/float64(total)*100)
	fmt.Printf("Average Latency: %.2f ms\n", avgLatency)
	fmt.Printf("Throughput: %.2f req/s\n", float64(total)/duration.Seconds())
	fmt.Println("===================================")
}
