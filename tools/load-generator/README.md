# Load Generator

API load generator for capacity planning and USL fitting.

## Usage

```bash
# Build
go build -o load-generator ./cmd

# Run baseline test
./load-generator run scenarios/baseline.yaml

# Run with metrics
./load-generator run --metrics-port 9100 scenarios/ramp-usl.yaml

# List scenarios
./load-generator list
```

## Arrival Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| constant | Steady RPS | Baseline measurement |
| ramp | Linear increase | USL curve fitting |
| step | Stepwise increase | Finding breaking points |
| spike | Sudden burst | Burst handling test |
| diurnal | 24h sine wave | Realistic traffic simulation |

## Scenarios

- `baseline.yaml` - Steady state for baseline metrics
- `ramp-usl.yaml` - Ramp test for USL curve fitting
- `spike.yaml` - Burst handling test
- `soak.yaml` - Long-duration stability test
- `mixed.yaml` - Realistic mixed workload

## Metrics

Exposed on `/metrics` (default port 9100):

| Metric | Type | Description |
|--------|------|-------------|
| loadgen_requests_total | Counter | Total requests by service/endpoint/status |
| loadgen_request_duration_seconds | Histogram | Request latency distribution |
| loadgen_target_rps | Gauge | Configured target RPS |
| loadgen_actual_rps | Gauge | Achieved RPS |
| loadgen_concurrency | Gauge | Current in-flight requests |
| loadgen_errors_total | Counter | Errors by type |

## Environment Variables

```bash
QUERY_SERVICE_URL=http://localhost:8081
RISK_ML_SERVICE_URL=http://localhost:8082
ALERT_SERVICE_URL=http://localhost:8083
GRAPH_SERVICE_URL=http://localhost:8084
BFF_URL=http://localhost:3001
```
