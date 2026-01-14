# Capacity Planning Notebooks

Jupyter notebooks for capacity modeling and analysis.

## Prerequisites

```bash
pip install jupyter pandas numpy scipy matplotlib requests
```

## Notebooks

### 1. USL Fitting

```python
# Quick USL analysis
from capacity_utils import USLAnalyzer

analyzer = USLAnalyzer(prometheus_url="http://localhost:19090")
result = analyzer.fit_service("query_service", "2026-01-14T00:00:00Z", "2026-01-14T01:00:00Z")
print(result.summary())
```

### 2. Little's Law Validation

```python
from capacity_utils import LittlesLawValidator

validator = LittlesLawValidator(prometheus_url="http://localhost:19090")
result = validator.validate("query_service")
print(f"Deviation: {result.deviation_ratio:.2f}")
```

## Metrics Required

| Metric | Description | Source |
|--------|-------------|--------|
| `{service}:usl_concurrency` | Active requests | Recording rule |
| `{service}:usl_throughput` | Successful req/s | Recording rule |
| `{service}_active_requests` | In-flight requests | Service metric |
| `{service}_http_request_duration_seconds` | Latency histogram | Service metric |

## Interpreting USL Results

### Coefficients

| Coefficient | Range | Meaning |
|-------------|-------|---------|
| σ < 0.01 | Low | Good linear scalability |
| σ > 0.1 | High | Serialization bottleneck |
| κ < 0.001 | Low | Minimal coordination overhead |
| κ > 0.01 | High | Excessive cross-node communication |

### Key Formulas

```
N_max = sqrt((1-σ)/κ)    # Maximum useful concurrency
X_max = USL(N_max)       # Maximum throughput
```

### Example Output

```
USL Analysis: query_service
==================================================
Coefficients:
  λ (single-thread throughput): 150.0 req/s
  σ (contention):               0.02
  κ (coherency):                0.0005

Scaling Limits:
  Max useful concurrency: 44 concurrent requests
  Max throughput: 3200 req/s

Interpretation:
  Contention: Low - good scalability
  Coherency: Low - minimal coordination overhead
```
