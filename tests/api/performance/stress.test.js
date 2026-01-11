/**
 * Stress Test
 * Tests system behavior under increasing load
 * Owner: W3 (CP-12)
 * 
 * Ramps up to 200 VUs to identify:
 * - Breaking points per service
 * - Latency degradation curves
 * - Error rate thresholds
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { slaDefinitions } from '../config/thresholds.js';
import { getRandomAddress, loadTestPool } from '../fixtures/addresses.js';

// Per-service latency metrics
const queryDuration = new Trend('query_stress_duration', true);
const riskDuration = new Trend('risk_stress_duration', true);
const graphDuration = new Trend('graph_stress_duration', true);
const alertDuration = new Trend('alert_stress_duration', true);
const bffDuration = new Trend('bff_stress_duration', true);

// Per-service error rates
const queryErrors = new Rate('query_stress_errors');
const riskErrors = new Rate('risk_stress_errors');
const graphErrors = new Rate('graph_stress_errors');
const alertErrors = new Rate('alert_stress_errors');
const bffErrors = new Rate('bff_stress_errors');

// Error counters by type
const client4xx = new Counter('client_errors_4xx');
const server5xx = new Counter('server_errors_5xx');
const timeouts = new Counter('timeouts');
const connectionErrors = new Counter('connection_errors');

// Track current load
const currentVUs = new Gauge('current_vus');

export const options = {
    scenarios: {
        stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 50 },   // Ramp up
                { duration: '2m', target: 100 },  // Moderate load
                { duration: '2m', target: 150 },  // High load
                { duration: '2m', target: 200 },  // Peak load
                { duration: '1m', target: 0 },    // Ramp down
            ],
        },
    },
    thresholds: {
        // Global thresholds
        'http_req_failed': ['rate<0.05'],
        'checks': ['rate>0.90'],
        
        // Per-service latency (relaxed for stress)
        'query_stress_duration': [`p(95)<${slaDefinitions['query-service'].p95 * 2}`],
        'risk_stress_duration': [`p(95)<${slaDefinitions['risk-ml-service'].p95 * 2}`],
        'graph_stress_duration': [`p(95)<${slaDefinitions['graph-service'].p95 * 2}`],
        'alert_stress_duration': [`p(95)<${slaDefinitions['alert-service'].p95 * 2}`],
        'bff_stress_duration': [`p(95)<${slaDefinitions['bff'].p95 * 2}`],
        
        // Error rates
        'query_stress_errors': ['rate<0.05'],
        'risk_stress_errors': ['rate<0.05'],
        'graph_stress_errors': ['rate<0.05'],
        'alert_stress_errors': ['rate<0.05'],
        'bff_stress_errors': ['rate<0.05'],
    },
};

const QUERY_URL = getBaseUrl('query-service');
const RISK_URL = getBaseUrl('risk-ml-service');
const GRAPH_URL = getBaseUrl('graph-service');
const ALERT_URL = getBaseUrl('alert-service');
const BFF_URL = getBaseUrl('bff');
const headers = getBffHeaders();

function recordError(res, errorRate, serviceName) {
    if (res.status === 0) {
        if (res.error_code === 1050) {
            timeouts.add(1);
        } else {
            connectionErrors.add(1);
        }
        errorRate.add(true);
        return;
    }
    
    if (res.status >= 400 && res.status < 500 && res.status !== 404) {
        client4xx.add(1);
        errorRate.add(true);
    } else if (res.status >= 500) {
        server5xx.add(1);
        errorRate.add(true);
    } else {
        errorRate.add(false);
    }
}

export default function () {
    const address = getRandomAddress();
    currentVUs.add(__VU);
    
    // Query Service
    group('Query Service', () => {
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}`, {
            timeout: '10s',
            tags: { service: 'query' },
        });
        queryDuration.add(Date.now() - start);
        recordError(res, queryErrors, 'query');
        
        check(res, {
            'query: responds': (r) => r.status !== 0,
            'query: not 5xx': (r) => r.status < 500,
        });
    });
    
    sleep(0.05);
    
    // Risk Service
    group('Risk Service', () => {
        const start = Date.now();
        const res = http.post(`${RISK_URL}/api/v1/risk/score`, JSON.stringify({
            address: address,
            network: 'ethereum',
        }), {
            headers: { 'Content-Type': 'application/json' },
            timeout: '15s',
            tags: { service: 'risk' },
        });
        riskDuration.add(Date.now() - start);
        recordError(res, riskErrors, 'risk');
        
        check(res, {
            'risk: responds': (r) => r.status !== 0,
            'risk: not 5xx': (r) => r.status < 500,
        });
    });
    
    sleep(0.05);
    
    // Graph Service
    group('Graph Service', () => {
        const start = Date.now();
        const res = http.get(`${GRAPH_URL}/api/v1/graph/address/${address}/neighbors?depth=1&limit=5`, {
            timeout: '10s',
            tags: { service: 'graph' },
        });
        graphDuration.add(Date.now() - start);
        recordError(res, graphErrors, 'graph');
        
        check(res, {
            'graph: responds': (r) => r.status !== 0,
            'graph: not 5xx': (r) => r.status < 500,
        });
    });
    
    sleep(0.05);
    
    // Alert Service
    group('Alert Service', () => {
        const start = Date.now();
        const res = http.get(`${ALERT_URL}/api/v1/alerts?limit=5`, {
            timeout: '10s',
            tags: { service: 'alert' },
        });
        alertDuration.add(Date.now() - start);
        recordError(res, alertErrors, 'alert');
        
        check(res, {
            'alert: responds': (r) => r.status !== 0,
            'alert: not 5xx': (r) => r.status < 500,
        });
    });
    
    sleep(0.05);
    
    // BFF (aggregated endpoint)
    group('BFF', () => {
        const start = Date.now();
        const res = http.get(`${BFF_URL}/api/v1/addresses/${address}`, {
            headers,
            timeout: '20s',
            tags: { service: 'bff' },
        });
        bffDuration.add(Date.now() - start);
        recordError(res, bffErrors, 'bff');
        
        check(res, {
            'bff: responds': (r) => r.status !== 0,
            'bff: not 5xx': (r) => r.status < 500,
        });
    });
    
    sleep(0.1);
}

export function handleSummary(data) {
    const m = data.metrics;
    
    const formatLatency = (metric) => {
        if (!metric || !metric.values) return { p50: 'N/A', p95: 'N/A', p99: 'N/A', max: 'N/A' };
        return {
            p50: metric.values['p(50)']?.toFixed(1) || 'N/A',
            p95: metric.values['p(95)']?.toFixed(1) || 'N/A',
            p99: metric.values['p(99)']?.toFixed(1) || 'N/A',
            max: metric.values['max']?.toFixed(1) || 'N/A',
        };
    };
    
    const formatErrorRate = (metric) => {
        if (!metric || !metric.values) return 'N/A';
        return (metric.values.rate * 100).toFixed(2) + '%';
    };
    
    const checkSLA = (metric, sla, factor = 2) => {
        if (!metric || !metric.values) return '⚠️';
        return metric.values['p(95)'] <= sla * factor ? '✅' : '❌';
    };
    
    const q = formatLatency(m.query_stress_duration);
    const r = formatLatency(m.risk_stress_duration);
    const g = formatLatency(m.graph_stress_duration);
    const a = formatLatency(m.alert_stress_duration);
    const b = formatLatency(m.bff_stress_duration);
    
    const summary = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                           STRESS TEST RESULTS                                 ║
║                      Peak: ${m.vus?.values?.max || 0} VUs @ ${m.http_reqs?.values?.rate?.toFixed(0) || 0} RPS                              ║
╠══════════════════════════════════════════════════════════════════════════════╣

LATENCY UNDER STRESS (ms)
────────────────────────────────────────────────────────────────────────────────
  Service          │  p50    │  p95    │  p99    │  max     │ SLA(2x) │ Status
  ─────────────────┼─────────┼─────────┼─────────┼──────────┼─────────┼────────
  Query Service    │ ${q.p50.padStart(6)} │ ${q.p95.padStart(6)} │ ${q.p99.padStart(6)} │ ${q.max.padStart(7)} │ ${(slaDefinitions['query-service'].p95 * 2).toString().padStart(6)} │ ${checkSLA(m.query_stress_duration, slaDefinitions['query-service'].p95)}
  Risk Service     │ ${r.p50.padStart(6)} │ ${r.p95.padStart(6)} │ ${r.p99.padStart(6)} │ ${r.max.padStart(7)} │ ${(slaDefinitions['risk-ml-service'].p95 * 2).toString().padStart(6)} │ ${checkSLA(m.risk_stress_duration, slaDefinitions['risk-ml-service'].p95)}
  Graph Service    │ ${g.p50.padStart(6)} │ ${g.p95.padStart(6)} │ ${g.p99.padStart(6)} │ ${g.max.padStart(7)} │ ${(slaDefinitions['graph-service'].p95 * 2).toString().padStart(6)} │ ${checkSLA(m.graph_stress_duration, slaDefinitions['graph-service'].p95)}
  Alert Service    │ ${a.p50.padStart(6)} │ ${a.p95.padStart(6)} │ ${a.p99.padStart(6)} │ ${a.max.padStart(7)} │ ${(slaDefinitions['alert-service'].p95 * 2).toString().padStart(6)} │ ${checkSLA(m.alert_stress_duration, slaDefinitions['alert-service'].p95)}
  BFF              │ ${b.p50.padStart(6)} │ ${b.p95.padStart(6)} │ ${b.p99.padStart(6)} │ ${b.max.padStart(7)} │ ${(slaDefinitions['bff'].p95 * 2).toString().padStart(6)} │ ${checkSLA(m.bff_stress_duration, slaDefinitions['bff'].p95)}

ERROR RATES BY SERVICE
────────────────────────────────────────────────────────────────────────────────
  Query Service:   ${formatErrorRate(m.query_stress_errors).padStart(8)}
  Risk Service:    ${formatErrorRate(m.risk_stress_errors).padStart(8)}
  Graph Service:   ${formatErrorRate(m.graph_stress_errors).padStart(8)}
  Alert Service:   ${formatErrorRate(m.alert_stress_errors).padStart(8)}
  BFF:             ${formatErrorRate(m.bff_stress_errors).padStart(8)}

ERROR BREAKDOWN
────────────────────────────────────────────────────────────────────────────────
  Client Errors (4xx):    ${m.client_errors_4xx?.values?.count || 0}
  Server Errors (5xx):    ${m.server_errors_5xx?.values?.count || 0}
  Timeouts:               ${m.timeouts?.values?.count || 0}
  Connection Errors:      ${m.connection_errors?.values?.count || 0}

THROUGHPUT
────────────────────────────────────────────────────────────────────────────────
  Total Requests:   ${m.http_reqs?.values?.count || 0}
  Peak RPS:         ${m.http_reqs?.values?.rate?.toFixed(1) || 0}
  Max VUs:          ${m.vus?.values?.max || 0}
  
THRESHOLDS
────────────────────────────────────────────────────────────────────────────────
  Passed: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}
  Failed: ${Object.values(data.thresholds || {}).filter(t => !t.ok).length}

ASSESSMENT
────────────────────────────────────────────────────────────────────────────────
  ${getAssessment(data)}

╚══════════════════════════════════════════════════════════════════════════════╝
`;
    
    return {
        'stdout': summary,
        'tests/api/performance/results/stress-summary.json': JSON.stringify(data, null, 2),
    };
}

function getAssessment(data) {
    const m = data.metrics;
    const failedThresholds = Object.values(data.thresholds || {}).filter(t => !t.ok).length;
    const serverErrors = m.server_errors_5xx?.values?.count || 0;
    const timeoutCount = m.timeouts?.values?.count || 0;
    
    if (failedThresholds === 0 && serverErrors === 0) {
        return '✅ PASS - System handles stress load within acceptable bounds';
    } else if (failedThresholds <= 2 && serverErrors < 10) {
        return '⚠️ DEGRADED - Minor degradation under stress, review bottlenecks';
    } else if (timeoutCount > 50) {
        return '❌ FAIL - Significant timeout issues, check service timeouts and capacity';
    } else {
        return '❌ FAIL - System unable to handle stress load, capacity planning required';
    }
}
