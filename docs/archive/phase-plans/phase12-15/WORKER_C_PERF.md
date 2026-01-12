# Worker C: Performance Testing

> Phase 15 implementation

---

## Role

Expand performance test suite, execute baseline tests, analyze results.

## Timeline

| Day | Checkpoints | Output |
|-----|-------------|--------|
| 1-3 | C1: Scenario Scripts | `tests/api/performance/*.test.js` (4 new) |
| 4 | (wait for Worker A chaos complete) | - |
| 5 | C2: Execute Tests | Test results |
| 6 | C3: Analyze & Report | `docs/performance/BASELINE_REPORT.md` |

**Note**: C2 depends on Worker A completing chaos tests (A5) to ensure system is stable.

---

## C1: Scenario Scripts

### Task

Create 4 new k6 performance scenarios.

### Existing (from Phase 11)

- `baseline.test.js` - 5min steady load
- `stress.test.js` - Ramp to breaking point
- `spike.test.js` - Sudden burst

### New Scenarios

| File | Purpose | Duration |
|------|---------|----------|
| sustained.test.js | Long-running stability | 30min |
| ramp.test.js | Gradual scale up/down | 15min |
| mixed.test.js | Read/write workload mix | 10min |
| db-stress.test.js | Complex query patterns | 10min |

---

### Sustained Load Test

```javascript
// tests/api/performance/sustained.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { getBaseUrl } from '../config/environments.js';

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = getBaseUrl('query-service');

export default function () {
  // Mix of endpoints
  const endpoints = [
    '/api/addresses/0x742d35Cc6634C0532925a3b844Bc9e7595f1',
    '/api/transfers?limit=10',
    '/health',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);
  
  check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'results/sustained-summary.json': JSON.stringify(data, null, 2),
  };
}
```

---

### Ramp Test

```javascript
// tests/api/performance/ramp.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { getBaseUrl } from '../config/environments.js';

export const options = {
  scenarios: {
    ramp_up_down: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 20 },   // Warm up
        { duration: '5m', target: 50 },   // Ramp to normal
        { duration: '3m', target: 100 },  // Ramp to peak
        { duration: '2m', target: 100 },  // Stay at peak
        { duration: '2m', target: 50 },   // Scale down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
  },
};

const SERVICES = {
  query: getBaseUrl('query-service'),
  risk: getBaseUrl('risk-ml-service'),
  alert: getBaseUrl('alert-service'),
  graph: getBaseUrl('graph-service'),
};

export default function () {
  // Round-robin services
  const services = Object.entries(SERVICES);
  const [name, url] = services[__VU % services.length];
  
  const res = http.get(`${url}/health`);
  check(res, {
    [`${name} healthy`]: (r) => r.status === 200,
  });
  
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'results/ramp-summary.json': JSON.stringify(data, null, 2),
  };
}
```

---

### Mixed Workload Test

```javascript
// tests/api/performance/mixed.test.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { getBaseUrl } from '../config/environments.js';
import { randomAddress } from '../fixtures/generators.js';

export const options = {
  scenarios: {
    readers: {
      executor: 'constant-vus',
      vus: 40,
      duration: '10m',
      exec: 'readWorkload',
    },
    writers: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      exec: 'writeWorkload',
    },
  },
  thresholds: {
    'http_req_duration{workload:read}': ['p(95)<300'],
    'http_req_duration{workload:write}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const QUERY_URL = getBaseUrl('query-service');
const ALERT_URL = getBaseUrl('alert-service');

export function readWorkload() {
  group('read', () => {
    const res = http.get(`${QUERY_URL}/api/addresses/${randomAddress()}`, {
      tags: { workload: 'read' },
    });
    check(res, { 'read ok': (r) => r.status === 200 || r.status === 404 });
  });
  sleep(0.5);
}

export function writeWorkload() {
  group('write', () => {
    const payload = JSON.stringify({
      name: `test-rule-${Date.now()}`,
      condition: 'risk_score > 0.8',
      severity: 'high',
      enabled: false,
    });
    
    const res = http.post(`${ALERT_URL}/api/rules`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { workload: 'write' },
    });
    
    check(res, { 'write ok': (r) => r.status === 201 || r.status === 200 });
    
    // Cleanup
    if (res.status === 201) {
      const id = JSON.parse(res.body).id;
      http.del(`${ALERT_URL}/api/rules/${id}`);
    }
  });
  sleep(2);
}

export function handleSummary(data) {
  return {
    'results/mixed-summary.json': JSON.stringify(data, null, 2),
  };
}
```

---

### Database Stress Test

```javascript
// tests/api/performance/db-stress.test.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { getBaseUrl } from '../config/environments.js';

export const options = {
  scenarios: {
    simple_queries: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      exec: 'simpleQueries',
    },
    complex_queries: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      exec: 'complexQueries',
    },
    aggregations: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10m',
      exec: 'aggregationQueries',
    },
  },
  thresholds: {
    'http_req_duration{query:simple}': ['p(95)<200'],
    'http_req_duration{query:complex}': ['p(95)<1000'],
    'http_req_duration{query:aggregation}': ['p(95)<2000'],
    http_req_failed: ['rate<0.02'],
  },
};

const QUERY_URL = getBaseUrl('query-service');
const GRAPH_URL = getBaseUrl('graph-service');

export function simpleQueries() {
  group('simple', () => {
    const res = http.get(`${QUERY_URL}/api/transfers?limit=10`, {
      tags: { query: 'simple' },
    });
    check(res, { 'simple ok': (r) => r.status === 200 });
  });
  sleep(0.2);
}

export function complexQueries() {
  group('complex', () => {
    // Query with multiple filters
    const params = new URLSearchParams({
      limit: '50',
      offset: '0',
      from_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1',
    });
    
    const res = http.get(`${QUERY_URL}/api/transfers?${params}`, {
      tags: { query: 'complex' },
    });
    check(res, { 'complex ok': (r) => r.status === 200 });
  });
  sleep(1);
}

export function aggregationQueries() {
  group('aggregation', () => {
    // Graph neighbor query (involves Neo4j)
    const res = http.get(
      `${GRAPH_URL}/api/addresses/0x742d35Cc6634C0532925a3b844Bc9e7595f1/neighbors?depth=2`,
      { tags: { query: 'aggregation' } }
    );
    check(res, { 'aggregation ok': (r) => r.status === 200 || r.status === 404 });
  });
  sleep(2);
}

export function handleSummary(data) {
  return {
    'results/db-stress-summary.json': JSON.stringify(data, null, 2),
  };
}
```

### Deliverables

- `tests/api/performance/sustained.test.js`
- `tests/api/performance/ramp.test.js`
- `tests/api/performance/mixed.test.js`
- `tests/api/performance/db-stress.test.js`

### Done

- [ ] 4 new scenarios created
- [ ] Thresholds match SLO targets
- [ ] Each scenario runs locally

---

## C2: Execute Tests

### Task

Run all performance tests and collect baselines.

### Execution Order

```bash
#!/bin/bash
# tests/api/performance/run-all.sh

set -e

RESULTS_DIR="tests/api/performance/results"
mkdir -p "$RESULTS_DIR"

echo "=== Performance Test Suite ==="
echo "Started: $(date)"

# 1. Baseline (existing)
echo "[1/7] Running baseline..."
k6 run tests/api/performance/baseline.test.js

# 2. Sustained
echo "[2/7] Running sustained (30min)..."
k6 run tests/api/performance/sustained.test.js

# 3. Ramp
echo "[3/7] Running ramp..."
k6 run tests/api/performance/ramp.test.js

# 4. Mixed
echo "[4/7] Running mixed workload..."
k6 run tests/api/performance/mixed.test.js

# 5. DB Stress
echo "[5/7] Running DB stress..."
k6 run tests/api/performance/db-stress.test.js

# 6. Stress (existing)
echo "[6/7] Running stress..."
k6 run tests/api/performance/stress.test.js

# 7. Spike (existing)
echo "[7/7] Running spike..."
k6 run tests/api/performance/spike.test.js

echo "=== Complete ==="
echo "Finished: $(date)"
echo "Results in: $RESULTS_DIR"
```

### Grafana Annotations

```bash
# Add annotation for test period
curl -X POST "http://localhost:13001/api/annotations" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboardUID": "slo-overview",
    "time": '$(date +%s000)',
    "timeEnd": '$(( $(date +%s) + 3600 ))000',
    "tags": ["performance-test"],
    "text": "Performance test run"
  }'
```

### Deliverables

- `tests/api/performance/run-all.sh`
- Test result JSON files in `results/`

### Done

- [ ] All 7 scenarios complete
- [ ] Results saved to `results/`
- [ ] Grafana annotations added

---

## C3: Analyze & Report

### Task

Analyze results and document baseline.

### Report Template

```markdown
# Performance Baseline Report

**Date**: 2026-01-XX
**Environment**: Remote Docker (dev-win)
**Duration**: ~75 minutes total

## Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| query-service P95 | <200ms | XXms | ✓/✗ |
| query-service P99 | <500ms | XXms | ✓/✗ |
| risk-ml-service P95 | <500ms | XXms | ✓/✗ |
| alert-service P95 | <200ms | XXms | ✓/✗ |
| graph-service P95 | <300ms | XXms | ✓/✗ |
| Error Rate | <1% | X.X% | ✓/✗ |

## Scenario Results

### Baseline (5min, 20 VUs)
- Requests: X,XXX
- RPS: XX
- P95: XXms
- Errors: X%

### Sustained (30min, 50 VUs)
- Requests: XX,XXX
- RPS: XX
- P95: XXms
- Errors: X%
- Memory trend: stable/growing

### Ramp (15min, 0→100 VUs)
- Peak RPS: XX
- P95 at peak: XXms
- Breaking point: XX VUs

### Mixed (10min, 40 read + 10 write)
- Read P95: XXms
- Write P95: XXms
- Errors: X%

### DB Stress (10min)
- Simple query P95: XXms
- Complex query P95: XXms
- Aggregation P95: XXms

## Bottlenecks Identified

1. **[Component]**: Description, impact
2. **[Component]**: Description, impact

## Recommendations

1. ...
2. ...

## Appendix

- Full results: `tests/api/performance/results/`
- Grafana dashboard: [link]
```

### Analysis Script

```bash
#!/bin/bash
# scripts/analyze-perf-results.sh

RESULTS_DIR="tests/api/performance/results"

echo "=== Performance Analysis ==="

for file in "$RESULTS_DIR"/*.json; do
  name=$(basename "$file" .json)
  echo ""
  echo "--- $name ---"
  
  # Extract key metrics
  jq -r '
    "Requests: \(.metrics.http_reqs.values.count // "N/A")",
    "RPS: \(.metrics.http_reqs.values.rate // "N/A" | floor)",
    "P95: \(.metrics.http_req_duration.values["p(95)"] // "N/A" | floor)ms",
    "P99: \(.metrics.http_req_duration.values["p(99)"] // "N/A" | floor)ms",
    "Errors: \((.metrics.http_req_failed.values.rate // 0) * 100 | floor)%"
  ' "$file"
done
```

### Deliverables

- `docs/performance/BASELINE_REPORT.md`
- `scripts/analyze-perf-results.sh`

### Done

- [ ] Report documents all scenarios
- [ ] Bottlenecks identified
- [ ] Recommendations provided

---

## File Checklist

```
tests/api/performance/
├── baseline.test.js      # (existing)
├── stress.test.js        # (existing)
├── spike.test.js         # (existing)
├── sustained.test.js     # NEW
├── ramp.test.js          # NEW
├── mixed.test.js         # NEW
├── db-stress.test.js     # NEW
├── run-all.sh            # NEW
└── results/
    ├── baseline-summary.json
    ├── sustained-summary.json
    ├── ramp-summary.json
    ├── mixed-summary.json
    ├── db-stress-summary.json
    ├── stress-summary.json
    └── spike-summary.json

docs/performance/
└── BASELINE_REPORT.md

scripts/
├── analyze-perf-results.sh
└── validate-phase15.sh
```

---

## Validation

```bash
#!/bin/bash
# scripts/validate-phase15.sh

echo "=== Phase 15 Validation ==="

# New scenarios exist
for s in sustained ramp mixed db-stress; do
  [ -f "tests/api/performance/${s}.test.js" ] \
    && echo "✓ ${s}.test.js" || echo "✗ ${s}.test.js"
done

# Results exist
[ -d "tests/api/performance/results" ] \
  && echo "✓ Results directory" || echo "✗ Results directory"

# Report exists
[ -f "docs/performance/BASELINE_REPORT.md" ] \
  && echo "✓ Baseline report" || echo "✗ Baseline report"

# Check SLA compliance from results
if [ -f "tests/api/performance/results/baseline-summary.json" ]; then
  P95=$(jq '.metrics.http_req_duration.values["p(95)"]' \
    tests/api/performance/results/baseline-summary.json)
  [ $(echo "$P95 < 500" | bc) -eq 1 ] \
    && echo "✓ P95 < 500ms ($P95)" || echo "✗ P95 >= 500ms ($P95)"
fi

echo "=== Done ==="
```
