# API Testing Framework

k6-based API testing suite for Chain Risk Platform (Phase 11).

## Structure

```
tests/api/
├── config/
│   ├── environments.js    # Multi-environment URLs
│   └── thresholds.js      # SLA definitions & test options
├── helpers/
│   ├── request.js         # Instrumented HTTP helpers
│   └── schema-validator.js # JSON validation
├── schemas/               # Response schemas (from OpenAPI)
├── fixtures/              # Test data & generators
├── contracts/             # Contract tests (schema validation)
├── functional/            # Business logic tests
│   ├── risk-scoring.test.js
│   ├── alert-rules.test.js
│   └── pipeline.test.js
└── performance/           # Load & stress tests
    ├── baseline.test.js
    ├── stress.test.js
    └── spike.test.js
```

## Quick Start

```bash
# Prerequisites
brew install k6

# Run all API tests
make api-test

# Run contract tests only
make api-test-contracts

# Run functional tests only
make api-test-functional

# Run performance baseline
make perf-test-baseline
```

## Test Categories

### Contract Tests
Validate API responses match OpenAPI specs:
```bash
make api-test-query      # Query Service
make api-test-risk       # Risk ML Service
make api-test-alert      # Alert Service
make api-test-graph      # Graph Service
make api-test-bff        # BFF
```

### Functional Tests
Validate business logic correctness:
```bash
make api-test-risk-logic   # Risk scoring logic
make api-test-alert-logic  # Alert rule CRUD
make api-test-pipeline     # Cross-service flows
```

### Performance Tests
```bash
make perf-test-baseline  # SLA baseline (5min)
make perf-test-stress    # Ramping load (8min)
make perf-test-spike     # Sudden burst (2min)
make perf-test-all       # All performance tests
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_ENV` | `remote` | `local` / `docker` / `remote` |
| `DOCKER_HOST_IP` | `localhost` | Remote Docker host |
| `TEST_USER_ID` | `1` | BFF test user ID |
| `TEST_USERNAME` | `testuser` | BFF test username |
| `TEST_ROLE` | `admin` | BFF test role |

## SLA Definitions

| Service | p95 | p99 | Error Rate | RPS |
|---------|-----|-----|------------|-----|
| query-service | 200ms | 500ms | <1% | 100 |
| risk-ml-service | 500ms | 1000ms | <1% | 50 |
| alert-service | 200ms | 500ms | <1% | 80 |
| graph-service | 300ms | 800ms | <1% | 80 |
| bff | 800ms | 1500ms | <1% | 50 |

## Test Results Summary (2026-01-11)

Tested against remote Docker environment.

| Test Suite | Pass Rate | Notes |
|------------|-----------|-------|
| Query Service Contract | 100% (54/54) | All endpoints working |
| Risk ML Service Contract | ~97% | 1 validation edge case |
| Alert Service Contract | ~90% | Minor schema differences |
| Graph Service Contract | ~95% | Working correctly |
| BFF Contract | ~77% | Some 404s expected (empty DB) |
| **Pipeline (Cross-Service)** | **100% (15/15)** | All services integrated |

### Known Limitations
- NestJS BFF returns `201` for POST (test expects `200` or `201`)
- Address queries return `404` when address not in database
- Risk ML uses cached results for repeated queries

## CI Integration

```yaml
# .github/workflows/api-test.yml
- name: API Contract Tests
  run: make api-test-ci

- name: Performance Baseline
  run: make perf-test-baseline
```

## Adding Tests

### Contract Test
```javascript
import { getBaseUrl } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';

export const options = contractTestOptions;

export default function () {
    group('GET /endpoint', () => {
        const res = http.get(`${BASE_URL}/endpoint`);
        check(res, { 'status 200': (r) => r.status === 200 });
    });
}
```

### Functional Test
```javascript
export default function () {
    group('Business Logic', () => {
        // Step 1
        // Step 2
        // Validate consistency
    });
}
```

## Results

Performance results saved to `tests/api/performance/results/`:
- `baseline-summary.json`
- `stress-summary.json`
- `spike-summary.json`
