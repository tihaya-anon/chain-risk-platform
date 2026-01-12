/**
 * Sustained Load Performance Test
 * Long-running stability test to detect memory leaks and degradation
 * Owner: Worker C (Phase 15)
 *
 * Duration: 30 minutes
 * Load: 50 constant VUs
 * Purpose: Verify system stability under prolonged load
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { slaDefinitions, buildThresholds } from '../config/thresholds.js';
import { getRandomAddress } from '../fixtures/addresses.js';
import { generateRiskScoreRequest } from '../fixtures/generators.js';

// Custom metrics for sustained monitoring
const sustainedLatency = new Trend('sustained_latency', true);
const sustainedErrors = new Rate('sustained_errors');
const sustainedRequests = new Counter('sustained_requests');

// Per-service metrics
const queryLatency = new Trend('query_service_duration', true);
const riskLatency = new Trend('risk_service_duration', true);
const graphLatency = new Trend('graph_service_duration', true);
const queryErrors = new Rate('query_service_errors');
const riskErrors = new Rate('risk_service_errors');
const graphErrors = new Rate('graph_service_errors');

export const options = {
    scenarios: {
        sustained: {
            executor: 'constant-vus',
            vus: 50,
            duration: '30m',
        },
    },
    thresholds: {
        ...buildThresholds(['query-service', 'risk-ml-service', 'graph-service'], 'baseline'),
        http_req_duration: ['p(95)<500', 'p(99)<1000'],
        http_req_failed: ['rate<0.01'],
        sustained_latency: ['p(95)<500', 'p(99)<1000'],
        sustained_errors: ['rate<0.01'],
    },
};

const QUERY_URL = getBaseUrl('query-service');
const RISK_URL = getBaseUrl('risk-ml-service');
const GRAPH_URL = getBaseUrl('graph-service');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Endpoint distribution for sustained load
const ENDPOINTS = [
    { name: 'query-address', weight: 30 },
    { name: 'query-transfers', weight: 20 },
    { name: 'risk-score', weight: 25 },
    { name: 'graph-neighbors', weight: 15 },
    { name: 'health-check', weight: 10 },
];

export default function () {
    const address = getRandomAddress();
    const endpoint = selectEndpoint();

    switch (endpoint) {
        case 'query-address':
            testQueryAddress(address);
            break;
        case 'query-transfers':
            testQueryTransfers(address);
            break;
        case 'risk-score':
            testRiskScore(address);
            break;
        case 'graph-neighbors':
            testGraphNeighbors(address);
            break;
        case 'health-check':
            testHealthChecks();
            break;
    }

    sleep(randomThinkTime(0.5, 1.5));
}

function testQueryAddress(address) {
    group('Sustained - Query Address', () => {
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}`);
        const duration = Date.now() - start;

        sustainedLatency.add(duration);
        queryLatency.add(duration);
        sustainedRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        sustainedErrors.add(isError);
        queryErrors.add(isError);

        check(res, {
            'query address: status ok': (r) => [200, 404].includes(r.status),
            'query address: latency ok': () => duration < 500,
        });
    });
}

function testQueryTransfers(address) {
    group('Sustained - Query Transfers', () => {
        const limit = [10, 20, 50][Math.floor(Math.random() * 3)];
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}/transfers?pageSize=${limit}`);
        const duration = Date.now() - start;

        sustainedLatency.add(duration);
        queryLatency.add(duration);
        sustainedRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        sustainedErrors.add(isError);
        queryErrors.add(isError);

        check(res, {
            'query transfers: status ok': (r) => [200, 404].includes(r.status),
            'query transfers: latency ok': () => duration < 500,
        });
    });
}

function testRiskScore(address) {
    group('Sustained - Risk Score', () => {
        const payload = generateRiskScoreRequest(address, { include_factors: false });
        const start = Date.now();
        const res = http.post(
            `${RISK_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );
        const duration = Date.now() - start;

        sustainedLatency.add(duration);
        riskLatency.add(duration);
        sustainedRequests.add(1);

        const isError = res.status >= 400;
        sustainedErrors.add(isError);
        riskErrors.add(isError);

        check(res, {
            'risk score: status 200': (r) => r.status === 200,
            'risk score: latency ok': () => duration < 1000,
        });
    });
}

function testGraphNeighbors(address) {
    group('Sustained - Graph Neighbors', () => {
        const depth = Math.random() > 0.7 ? 2 : 1;
        const start = Date.now();
        const res = http.get(`${GRAPH_URL}/api/v1/graph/address/${address}/neighbors?depth=${depth}&limit=10`);
        const duration = Date.now() - start;

        sustainedLatency.add(duration);
        graphLatency.add(duration);
        sustainedRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        sustainedErrors.add(isError);
        graphErrors.add(isError);

        check(res, {
            'graph neighbors: status ok': (r) => [200, 404].includes(r.status),
            'graph neighbors: latency ok': () => duration < 1000,
        });
    });
}

function testHealthChecks() {
    group('Sustained - Health Checks', () => {
        const services = [
            { name: 'query', url: `${QUERY_URL}/health` },
            { name: 'risk', url: `${RISK_URL}/health` },
            { name: 'graph', url: `${GRAPH_URL}/health` },
        ];

        const svc = services[Math.floor(Math.random() * services.length)];
        const start = Date.now();
        const res = http.get(svc.url);
        const duration = Date.now() - start;

        sustainedLatency.add(duration);
        sustainedRequests.add(1);

        const isError = res.status !== 200;
        sustainedErrors.add(isError);

        check(res, {
            [`${svc.name} health: status 200`]: (r) => r.status === 200,
        });
    });
}

function selectEndpoint() {
    const total = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * total;

    for (const endpoint of ENDPOINTS) {
        random -= endpoint.weight;
        if (random <= 0) return endpoint.name;
    }
    return ENDPOINTS[0].name;
}

function randomThinkTime(min, max) {
    return min + Math.random() * (max - min);
}

export function handleSummary(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        stdout: generateReport(data),
        [`tests/api/performance/results/sustained-${timestamp}.json`]: JSON.stringify(data, null, 2),
        'tests/api/performance/results/sustained-summary.json': JSON.stringify(data, null, 2),
    };
}

function generateReport(data) {
    const m = data.metrics;
    const formatDuration = (metric, pct) => metric?.values?.[`p(${pct})`]?.toFixed(2) || 'N/A';
    const formatRate = (metric) => ((metric?.values?.rate || 0) * 100).toFixed(2);

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                      SUSTAINED LOAD TEST REPORT                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
 Duration: 30 minutes | VUs: 50 | Purpose: Long-running stability

 OVERALL METRICS
 ───────────────────────────────────────────────────────────────────────────────
   Total Requests:     ${m.sustained_requests?.values?.count || 0}
   Overall RPS:        ${(m.http_reqs?.values?.rate || 0).toFixed(2)}
   Overall P95:        ${formatDuration(m.sustained_latency, 95)}ms
   Overall P99:        ${formatDuration(m.sustained_latency, 99)}ms
   Error Rate:         ${formatRate(m.sustained_errors)}%

 PER-SERVICE LATENCY (p95 / p99)
 ───────────────────────────────────────────────────────────────────────────────
   Query Service:      ${formatDuration(m.query_service_duration, 95)}ms / ${formatDuration(m.query_service_duration, 99)}ms
   Risk ML Service:    ${formatDuration(m.risk_service_duration, 95)}ms / ${formatDuration(m.risk_service_duration, 99)}ms
   Graph Service:      ${formatDuration(m.graph_service_duration, 95)}ms / ${formatDuration(m.graph_service_duration, 99)}ms

 STABILITY INDICATORS
 ───────────────────────────────────────────────────────────────────────────────
   Check Pass Rate:    ${((m.checks?.values?.passes / (m.checks?.values?.passes + m.checks?.values?.fails)) * 100 || 0).toFixed(2)}%
   Memory Trend:       Monitor Grafana for detailed memory analysis

╚══════════════════════════════════════════════════════════════════════════════╝
`;
}
