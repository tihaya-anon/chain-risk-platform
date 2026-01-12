/**
 * Ramp Performance Test
 * Gradual scale up/down to identify performance degradation patterns
 * Owner: Worker C (Phase 15)
 *
 * Duration: 15 minutes
 * Load: 0 → 20 → 50 → 100 → 100 → 50 VUs
 * Purpose: Test scalability and identify breaking points
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { slaDefinitions, buildThresholds } from '../config/thresholds.js';

// Custom metrics for ramp test
const rampLatency = new Trend('ramp_latency', true);
const rampErrors = new Rate('ramp_errors');
const rampRequests = new Counter('ramp_requests');
const currentVUs = new Gauge('current_vus');

// Per-service metrics
const queryLatency = new Trend('query_service_duration', true);
const riskLatency = new Trend('risk_ml_service_duration', true);
const alertLatency = new Trend('alert_service_duration', true);
const graphLatency = new Trend('graph_service_duration', true);

const queryErrors = new Rate('query_service_errors');
const riskErrors = new Rate('risk_ml_service_errors');
const alertErrors = new Rate('alert_service_errors');
const graphErrors = new Rate('graph_service_errors');

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
        ramp_latency: ['p(95)<800', 'p(99)<1500'],
        ramp_errors: ['rate<0.02'],
        query_service_duration: ['p(95)<300'],
        risk_ml_service_duration: ['p(95)<800'],
        alert_service_duration: ['p(95)<300'],
        graph_service_duration: ['p(95)<500'],
    },
};

const SERVICES = {
    query: {
        url: getBaseUrl('query-service'),
        endpoints: ['/health', '/api/v1/addresses'],
        sla: slaDefinitions['query-service'],
    },
    risk: {
        url: getBaseUrl('risk-ml-service'),
        endpoints: ['/health'],
        sla: slaDefinitions['risk-ml-service'],
    },
    alert: {
        url: getBaseUrl('alert-service'),
        endpoints: ['/health', '/api/v1/rules'],
        sla: slaDefinitions['alert-service'],
    },
    graph: {
        url: getBaseUrl('graph-service'),
        endpoints: ['/health'],
        sla: slaDefinitions['graph-service'],
    },
};

export default function () {
    currentVUs.add(__VU);

    // Round-robin services based on VU
    const serviceKeys = Object.keys(SERVICES);
    const svcKey = serviceKeys[__VU % serviceKeys.length];
    const service = SERVICES[svcKey];

    testService(svcKey, service);
    sleep(randomThinkTime(0.3, 0.7));
}

function testService(name, service) {
    group(`Ramp - ${name}`, () => {
        const endpoint = service.endpoints[Math.floor(Math.random() * service.endpoints.length)];
        const url = `${service.url}${endpoint}`;

        const start = Date.now();
        const res = http.get(url);
        const duration = Date.now() - start;

        // Global metrics
        rampLatency.add(duration);
        rampRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        rampErrors.add(isError);

        // Per-service metrics
        switch (name) {
            case 'query':
                queryLatency.add(duration);
                queryErrors.add(isError);
                break;
            case 'risk':
                riskLatency.add(duration);
                riskErrors.add(isError);
                break;
            case 'alert':
                alertLatency.add(duration);
                alertErrors.add(isError);
                break;
            case 'graph':
                graphLatency.add(duration);
                graphErrors.add(isError);
                break;
        }

        check(res, {
            [`${name}: status ok`]: (r) => [200, 404].includes(r.status),
            [`${name}: latency within SLA`]: () => duration < service.sla.p95 * 2,
        });
    });
}

function randomThinkTime(min, max) {
    return min + Math.random() * (max - min);
}

export function handleSummary(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        stdout: generateReport(data),
        [`tests/api/performance/results/ramp-${timestamp}.json`]: JSON.stringify(data, null, 2),
        'tests/api/performance/results/ramp-summary.json': JSON.stringify(data, null, 2),
    };
}

function generateReport(data) {
    const m = data.metrics;
    const formatDuration = (metric, pct) => metric?.values?.[`p(${pct})`]?.toFixed(2) || 'N/A';
    const formatRate = (metric) => ((metric?.values?.rate || 0) * 100).toFixed(2);

    const checkSLA = (metric, sla) => {
        const p95 = metric?.values?.['p(95)'];
        if (!p95) return '❓';
        return p95 <= sla ? '✅' : '❌';
    };

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                         RAMP TEST REPORT                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
 Duration: 15 minutes | Pattern: 0→20→50→100→100→50 VUs

 OVERALL METRICS
 ───────────────────────────────────────────────────────────────────────────────
   Total Requests:     ${m.ramp_requests?.values?.count || 0}
   Peak RPS:           ${(m.http_reqs?.values?.rate || 0).toFixed(2)}
   Overall P95:        ${formatDuration(m.ramp_latency, 95)}ms
   Overall P99:        ${formatDuration(m.ramp_latency, 99)}ms
   Error Rate:         ${formatRate(m.ramp_errors)}%

 PER-SERVICE PERFORMANCE (p95)
 ───────────────────────────────────────────────────────────────────────────────
   Query Service:      ${formatDuration(m.query_service_duration, 95)}ms    ${checkSLA(m.query_service_duration, 300)} (SLA: <300ms)
   Risk ML Service:    ${formatDuration(m.risk_ml_service_duration, 95)}ms    ${checkSLA(m.risk_ml_service_duration, 800)} (SLA: <800ms)
   Alert Service:      ${formatDuration(m.alert_service_duration, 95)}ms    ${checkSLA(m.alert_service_duration, 300)} (SLA: <300ms)
   Graph Service:      ${formatDuration(m.graph_service_duration, 95)}ms    ${checkSLA(m.graph_service_duration, 500)} (SLA: <500ms)

 SCALING ANALYSIS
 ───────────────────────────────────────────────────────────────────────────────
   Warmup (20 VUs):    See Grafana for stage-by-stage analysis
   Normal (50 VUs):    Baseline comparison stage
   Peak (100 VUs):     Max load stage - check for degradation
   Cooldown:           Recovery verification

 THRESHOLD RESULTS
 ───────────────────────────────────────────────────────────────────────────────
   Passed: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}
   Failed: ${Object.values(data.thresholds || {}).filter(t => !t.ok).length}

╚══════════════════════════════════════════════════════════════════════════════╝
`;
}
