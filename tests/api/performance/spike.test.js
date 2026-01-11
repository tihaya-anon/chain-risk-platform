/**
 * Spike Test
 * Tests system behavior under sudden traffic spikes
 * Owner: W3 (CP-12)
 * 
 * Simulates sudden traffic surge to 500 VUs to identify:
 * - System resilience under sudden load
 * - Recovery behavior after spike
 * - Circuit breaker activation
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { getRandomAddress } from '../fixtures/addresses.js';

// Spike metrics
const spikeDuration = new Trend('spike_duration', true);
const spikeErrors = new Rate('spike_errors');
const spike5xx = new Counter('spike_5xx');
const spikeTimeouts = new Counter('spike_timeouts');
const spikeConnErrors = new Counter('spike_conn_errors');

// Phase tracking
const phaseGauge = new Gauge('test_phase');
const recoveryLatency = new Trend('recovery_latency', true);

export const options = {
    scenarios: {
        spike: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 },    // Baseline
                { duration: '10s', target: 500 },   // Spike up
                { duration: '1m', target: 500 },    // Hold spike
                { duration: '10s', target: 50 },    // Spike down
                { duration: '30s', target: 50 },    // Recovery
                { duration: '10s', target: 0 },     // Ramp down
            ],
        },
    },
    thresholds: {
        'checks': ['rate>0.85'],                    // Allow some failures during spike
        'http_req_failed': ['rate<0.10'],           // Up to 10% failure during spike
        'spike_5xx': ['count<100'],                 // Limit server errors
        'spike_timeouts': ['count<50'],             // Limit timeouts
        'recovery_latency': ['p(95)<1000'],         // Recovery should be responsive
    },
};

const BFF_URL = getBaseUrl('bff');
const headers = getBffHeaders();

// Determine current test phase based on time
function getPhase(elapsed) {
    if (elapsed < 30) return { name: 'baseline', code: 1 };
    if (elapsed < 40) return { name: 'spike_up', code: 2 };
    if (elapsed < 100) return { name: 'spike_hold', code: 3 };
    if (elapsed < 110) return { name: 'spike_down', code: 4 };
    if (elapsed < 140) return { name: 'recovery', code: 5 };
    return { name: 'ramp_down', code: 6 };
}

let testStart = null;

export default function () {
    if (!testStart) testStart = Date.now();
    const elapsed = (Date.now() - testStart) / 1000;
    const phase = getPhase(elapsed);
    phaseGauge.add(phase.code);
    
    const address = getRandomAddress();
    
    // Primary request
    const start = Date.now();
    const res = http.get(`${BFF_URL}/api/v1/addresses/${address}`, {
        headers,
        timeout: '30s',
        tags: { phase: phase.name },
    });
    const duration = Date.now() - start;
    spikeDuration.add(duration);
    
    // Error tracking
    if (res.status === 0) {
        if (res.error_code === 1050) {
            spikeTimeouts.add(1);
        } else {
            spikeConnErrors.add(1);
        }
        spikeErrors.add(true);
    } else if (res.status >= 500) {
        spike5xx.add(1);
        spikeErrors.add(true);
    } else if (res.status >= 400 && res.status !== 404) {
        spikeErrors.add(true);
    } else {
        spikeErrors.add(false);
    }
    
    // Track recovery phase latency separately
    if (phase.name === 'recovery') {
        recoveryLatency.add(duration);
    }
    
    check(res, {
        'responds': (r) => r.status !== 0,
        'not 5xx': (r) => r.status < 500,
    });
    
    // Minimal sleep during spike, more during recovery
    if (phase.name === 'spike_hold') {
        sleep(0.02);
    } else if (phase.name === 'recovery') {
        sleep(0.1);
    } else {
        sleep(0.05);
    }
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
    
    const spike = formatLatency(m.spike_duration);
    const recovery = formatLatency(m.recovery_latency);
    
    const serverErrors = m.spike_5xx?.values?.count || 0;
    const timeoutCount = m.spike_timeouts?.values?.count || 0;
    const connErrors = m.spike_conn_errors?.values?.count || 0;
    const totalRequests = m.http_reqs?.values?.count || 0;
    const errorRate = m.spike_errors?.values?.rate || 0;
    
    const summary = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                            SPIKE TEST RESULTS                                 ║
║                     Spike to ${m.vus?.values?.max || 0} VUs @ ${m.http_reqs?.values?.rate?.toFixed(0) || 0} peak RPS                          ║
╠══════════════════════════════════════════════════════════════════════════════╣

TEST PHASES
────────────────────────────────────────────────────────────────────────────────
  1. Baseline (0-30s)      │  50 VUs   │  Establish baseline metrics
  2. Spike Up (30-40s)     │  →500 VUs │  Sudden traffic surge
  3. Spike Hold (40-100s)  │  500 VUs  │  Sustained high load
  4. Spike Down (100-110s) │  →50 VUs  │  Traffic drop
  5. Recovery (110-140s)   │  50 VUs   │  System recovery phase

LATENCY DURING SPIKE (ms)
────────────────────────────────────────────────────────────────────────────────
  Metric        │  p50     │  p95      │  p99      │  max
  ──────────────┼──────────┼───────────┼───────────┼───────────
  Overall       │ ${spike.p50.padStart(7)} │ ${spike.p95.padStart(8)} │ ${spike.p99.padStart(8)} │ ${spike.max.padStart(8)}
  Recovery      │ ${recovery.p50.padStart(7)} │ ${recovery.p95.padStart(8)} │ ${recovery.p99.padStart(8)} │ ${recovery.max.padStart(8)}

ERROR ANALYSIS
────────────────────────────────────────────────────────────────────────────────
  Total Requests:       ${totalRequests}
  Error Rate:           ${(errorRate * 100).toFixed(2)}%
  
  Server Errors (5xx):  ${serverErrors}
  Timeouts:             ${timeoutCount}
  Connection Errors:    ${connErrors}

THROUGHPUT
────────────────────────────────────────────────────────────────────────────────
  Peak VUs:             ${m.vus?.values?.max || 0}
  Peak RPS:             ${m.http_reqs?.values?.rate?.toFixed(1) || 0}
  Total Duration:       ~2.5 minutes

RECOVERY ASSESSMENT
────────────────────────────────────────────────────────────────────────────────
  ${getRecoveryAssessment(m)}

THRESHOLDS
────────────────────────────────────────────────────────────────────────────────
  Passed: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}
  Failed: ${Object.values(data.thresholds || {}).filter(t => !t.ok).length}

OVERALL ASSESSMENT
────────────────────────────────────────────────────────────────────────────────
  ${getOverallAssessment(data, m)}

╚══════════════════════════════════════════════════════════════════════════════╝
`;
    
    return {
        'stdout': summary,
        'tests/api/performance/results/spike-summary.json': JSON.stringify(data, null, 2),
    };
}

function getRecoveryAssessment(m) {
    const recoveryP95 = m.recovery_latency?.values?.['p(95)'] || Infinity;
    
    if (recoveryP95 < 500) {
        return '✅ EXCELLENT - System recovers quickly after spike (p95 < 500ms)';
    } else if (recoveryP95 < 1000) {
        return '✅ GOOD - System recovers within acceptable time (p95 < 1s)';
    } else if (recoveryP95 < 2000) {
        return '⚠️ SLOW - Recovery is slow, investigate resource release (p95 < 2s)';
    } else {
        return '❌ POOR - System does not recover well, check for resource leaks';
    }
}

function getOverallAssessment(data, m) {
    const failedThresholds = Object.values(data.thresholds || {}).filter(t => !t.ok).length;
    const serverErrors = m.spike_5xx?.values?.count || 0;
    const timeouts = m.spike_timeouts?.values?.count || 0;
    const errorRate = m.spike_errors?.values?.rate || 0;
    
    if (failedThresholds === 0 && errorRate < 0.02) {
        return '✅ EXCELLENT - System handles traffic spikes gracefully';
    } else if (failedThresholds <= 1 && errorRate < 0.05) {
        return '✅ PASS - System degrades gracefully under spike, acceptable performance';
    } else if (errorRate < 0.10 && serverErrors < 50) {
        return '⚠️ DEGRADED - Significant degradation during spike, consider scaling strategy';
    } else if (timeouts > 50) {
        return '❌ FAIL - System experiences cascading timeouts under spike';
    } else {
        return '❌ FAIL - System cannot handle traffic spikes, requires capacity planning';
    }
}
