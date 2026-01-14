package config

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Scenario represents a load test scenario configuration.
type Scenario struct {
	Name      string        `yaml:"name"`
	Duration  time.Duration `yaml:"duration"`
	Workloads []Workload    `yaml:"workloads"`
}

// Workload represents a single workload within a scenario.
type Workload struct {
	Service        string            `yaml:"service"`
	Endpoint       string            `yaml:"endpoint"`
	Method         string            `yaml:"method"`
	Pattern        string            `yaml:"pattern"`         // constant, ramp, step, spike, diurnal
	RPS            float64           `yaml:"rps"`             // requests per second (for constant)
	RPSStart       float64           `yaml:"rps_start"`       // starting RPS (for ramp)
	RPSEnd         float64           `yaml:"rps_end"`         // ending RPS (for ramp)
	StepDuration   time.Duration     `yaml:"step_duration"`   // duration per step (for ramp/step)
	SpikeAt        time.Duration     `yaml:"spike_at"`        // when to spike (for spike pattern)
	SpikeDuration  time.Duration     `yaml:"spike_duration"`  // how long spike lasts
	SpikeMultiplier float64          `yaml:"spike_multiplier"` // multiplier for spike
	Headers        map[string]string `yaml:"headers"`
	Body           string            `yaml:"body"`            // request body template
	BodyParams     map[string]string `yaml:"body_params"`     // parameters for body template
	Timeout        time.Duration     `yaml:"timeout"`
	TLS            bool              `yaml:"tls"`
}

// ServiceEndpoints contains base URLs for services.
type ServiceEndpoints struct {
	QueryService   string `yaml:"query_service"`
	RiskMLService  string `yaml:"risk_ml_service"`
	AlertService   string `yaml:"alert_service"`
	GraphService   string `yaml:"graph_service"`
	BFF            string `yaml:"bff"`
}

// LoadScenario loads a scenario from a YAML file.
func LoadScenario(path string) (*Scenario, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var scenario Scenario
	if err := yaml.Unmarshal(data, &scenario); err != nil {
		return nil, err
	}

	// Set defaults
	for i := range scenario.Workloads {
		if scenario.Workloads[i].Method == "" {
			scenario.Workloads[i].Method = "GET"
		}
		if scenario.Workloads[i].Timeout == 0 {
			scenario.Workloads[i].Timeout = 10 * time.Second
		}
		if scenario.Workloads[i].Pattern == "" {
			scenario.Workloads[i].Pattern = "constant"
		}
	}

	return &scenario, nil
}

// GetServiceURL returns the URL for a service.
func GetServiceURL(service string) string {
	endpoints := map[string]string{
		"query-service":   getEnv("QUERY_SERVICE_URL", "http://localhost:8081"),
		"risk-ml-service": getEnv("RISK_ML_SERVICE_URL", "http://localhost:8082"),
		"alert-service":   getEnv("ALERT_SERVICE_URL", "http://localhost:8083"),
		"graph-service":   getEnv("GRAPH_SERVICE_URL", "http://localhost:8084"),
		"bff":             getEnv("BFF_URL", "http://localhost:3001"),
	}
	return endpoints[service]
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
