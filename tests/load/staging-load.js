# K6 Load Test Configuration
# Run: k6 run tests/load/staging-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const riskLatency = new Trend('risk_latency');
const queryLatency = new Trend('query_latency');

// Test configuration
export const options = {
    scenarios: {
        // Smoke test
        smoke: {
            executor: 'constant-vus',
            vus: 5,
            duration: '1m',
            startTime: '0s',
        },
        // Load test
        load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 20 },
                { duration: '5m', target: 50 },
                { duration: '2m', target: 100 },
                { duration: '5m', target: 100 },
                { duration: '2m', target: 0 },
            ],
            startTime: '1m',
        },
        // Spike test
        spike: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 200 },
                { duration: '1m', target: 200 },
                { duration: '10s', target: 0 },
            ],
            startTime: '16m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'],
        errors: ['rate<0.1'],
        risk_latency: ['p(95)<500'],
        query_latency: ['p(95)<300'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Test addresses
const addresses = [
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003',
    '0xdead000000000000000000000000000000000000',
    '0xbeef000000000000000000000000000000000000',
];

export default function () {
    const addr = addresses[Math.floor(Math.random() * addresses.length)];

    // Health check
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
        'health status 200': (r) => r.status === 200,
    });

    // Risk score query
    const riskStart = Date.now();
    const riskRes = http.get(`${BASE_URL}/api/v1/risk/${addr}`);
    riskLatency.add(Date.now() - riskStart);
    
    const riskOk = check(riskRes, {
        'risk status 200 or 404': (r) => r.status === 200 || r.status === 404,
        'risk has score': (r) => r.status === 404 || JSON.parse(r.body).score !== undefined,
    });
    errorRate.add(!riskOk);

    sleep(0.5);

    // Address query
    const queryStart = Date.now();
    const queryRes = http.get(`${BASE_URL}/api/v1/addresses/${addr}`);
    queryLatency.add(Date.now() - queryStart);
    
    const queryOk = check(queryRes, {
        'query status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(!queryOk);

    sleep(0.5);

    // Transactions query
    const txRes = http.get(`${BASE_URL}/api/v1/addresses/${addr}/transactions?limit=10`);
    check(txRes, {
        'tx status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    sleep(1);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'tests/load/results/summary.json': JSON.stringify(data),
    };
}

function textSummary(data, opts) {
    const metrics = data.metrics;
    return `
=== Load Test Summary ===

Requests:
  Total: ${metrics.http_reqs.values.count}
  Rate: ${metrics.http_reqs.values.rate.toFixed(2)}/s

Response Time (p95):
  Overall: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  Risk API: ${metrics.risk_latency?.values['p(95)']?.toFixed(2) || 'N/A'}ms
  Query API: ${metrics.query_latency?.values['p(95)']?.toFixed(2) || 'N/A'}ms

Errors:
  Rate: ${(metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%

Thresholds:
  Passed: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}
  Failed: ${Object.values(data.thresholds || {}).filter(t => !t.ok).length}
`;
}
