/**
 * Baseline Performance Test Suite
 * Establishes SLA baselines for all services under normal load
 * Owner: W2 (CP-11)
 *
 * Test Strategy:
 * 1. Warmup phase: Gradual ramp to stabilize connections
 * 2. Baseline phase: Constant rate to measure steady-state performance
 * 3. Endpoint mix: Weighted distribution matching production patterns
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { baselineTestOptions, slaDefinitions } from '../config/thresholds.js';
import {
    getRandomAddress,
    loadTestPool,
    testAddresses,
    exchangeAddresses,
} from '../fixtures/addresses.js';
import {
    generateRiskScoreRequest,
    generateBatchRiskRequest,
    randomAddressBatch,
} from '../fixtures/generators.js';

// ============================================================================
// Custom Metrics
// ============================================================================

// Latency metrics per service
const queryLatency = new Trend('query_service_duration', true);
const queryAddressLatency = new Trend('query_address_duration', true);
const queryTransfersLatency = new Trend('query_transfers_duration', true);
const queryStatsLatency = new Trend('query_stats_duration', true);

const riskLatency = new Trend('risk_service_duration', true);
const riskScoreLatency = new Trend('risk_score_duration', true);
const riskBatchLatency = new Trend('risk_batch_duration', true);

const graphLatency = new Trend('graph_service_duration', true);
const graphNeighborsLatency = new Trend('graph_neighbors_duration', true);

const bffLatency = new Trend('bff_duration', true);

// Error rates per service
const queryErrors = new Rate('query_service_errors');
const riskErrors = new Rate('risk_service_errors');
const graphErrors = new Rate('graph_service_errors');
const bffErrors = new Rate('bff_errors');

// Request counters
const queryRequests = new Counter('query_service_requests');
const riskRequests = new Counter('risk_service_requests');
const graphRequests = new Counter('graph_service_requests');
const bffRequests = new Counter('bff_requests');

// ============================================================================
// Configuration
// ============================================================================

export const options = baselineTestOptions;

const QUERY_URL = getBaseUrl('query-service');
const RISK_URL = getBaseUrl('risk-ml-service');
const GRAPH_URL = getBaseUrl('graph-service');
const BFF_URL = getBaseUrl('bff');
const headers = getBffHeaders();

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Weighted endpoint distribution (simulating production traffic)
const ENDPOINT_WEIGHTS = {
    queryAddress: 25,      // 25% - Most common: lookup address info
    queryTransfers: 15,    // 15% - List transfers
    queryStats: 10,        // 10% - Address statistics
    riskScore: 20,         // 20% - Single risk score
    riskBatch: 5,          // 5%  - Batch scoring (less frequent)
    graphNeighbors: 10,    // 10% - Graph queries
    bffAggregated: 15,     // 15% - BFF aggregated calls
};

// ============================================================================
// Main Test Function
// ============================================================================

export default function () {
    const address = getRandomAddress();
    const endpoint = selectWeightedEndpoint();

    switch (endpoint) {
        case 'queryAddress':
            testQueryAddress(address);
            break;
        case 'queryTransfers':
            testQueryTransfers(address);
            break;
        case 'queryStats':
            testQueryStats(address);
            break;
        case 'riskScore':
            testRiskScore(address);
            break;
        case 'riskBatch':
            testRiskBatch();
            break;
        case 'graphNeighbors':
            testGraphNeighbors(address);
            break;
        case 'bffAggregated':
            testBffAggregated(address);
            break;
    }

    // Think time between requests
    sleep(randomThinkTime(0.1, 0.5));
}

// ============================================================================
// Test Functions
// ============================================================================

function testQueryAddress(address) {
    group('Query Service - Address Info', () => {
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}`);
        const duration = Date.now() - start;

        queryLatency.add(duration);
        queryAddressLatency.add(duration);
        queryRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        queryErrors.add(isError);

        check(res, {
            'query address: status ok': (r) => [200, 404].includes(r.status),
            'query address: response time < 500ms': (r) => duration < 500,
        });
    });
}

function testQueryTransfers(address) {
    group('Query Service - Transfers', () => {
        const page = Math.floor(Math.random() * 5) + 1;
        const pageSize = [10, 20, 50][Math.floor(Math.random() * 3)];

        const start = Date.now();
        const res = http.get(
            `${QUERY_URL}/api/v1/addresses/${address}/transfers?page=${page}&pageSize=${pageSize}`
        );
        const duration = Date.now() - start;

        queryLatency.add(duration);
        queryTransfersLatency.add(duration);
        queryRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        queryErrors.add(isError);

        check(res, {
            'query transfers: status ok': (r) => [200, 404].includes(r.status),
            'query transfers: response time < 500ms': (r) => duration < 500,
        });
    });
}

function testQueryStats(address) {
    group('Query Service - Stats', () => {
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}/stats`);
        const duration = Date.now() - start;

        queryLatency.add(duration);
        queryStatsLatency.add(duration);
        queryRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        queryErrors.add(isError);

        check(res, {
            'query stats: status ok': (r) => [200, 404].includes(r.status),
            'query stats: response time < 500ms': (r) => duration < 500,
        });
    });
}

function testRiskScore(address) {
    group('Risk Service - Single Score', () => {
        const payload = generateRiskScoreRequest(address, {
            include_factors: Math.random() > 0.7, // 30% include factors
        });

        const start = Date.now();
        const res = http.post(
            `${RISK_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );
        const duration = Date.now() - start;

        riskLatency.add(duration);
        riskScoreLatency.add(duration);
        riskRequests.add(1);

        const isError = res.status >= 400;
        riskErrors.add(isError);

        check(res, {
            'risk score: status 200': (r) => r.status === 200,
            'risk score: response time < 1000ms': (r) => duration < 1000,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'risk score: has score': (b) => 'risk_score' in b,
                'risk score: score in range': (b) =>
                    b.risk_score >= 0 && b.risk_score <= 1,
            });
        }
    });
}

function testRiskBatch() {
    group('Risk Service - Batch Score', () => {
        const batchSize = [5, 10, 20][Math.floor(Math.random() * 3)];
        const addresses = randomAddressBatch(batchSize);
        const payload = generateBatchRiskRequest(addresses);

        const start = Date.now();
        const res = http.post(
            `${RISK_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );
        const duration = Date.now() - start;

        riskLatency.add(duration);
        riskBatchLatency.add(duration);
        riskRequests.add(1);

        const isError = res.status >= 400;
        riskErrors.add(isError);

        check(res, {
            'risk batch: status 200': (r) => r.status === 200,
            'risk batch: response time < 2000ms': (r) => duration < 2000,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'risk batch: has results': (b) => Array.isArray(b.results),
                'risk batch: total matches': (b) => b.total === batchSize,
            });
        }
    });
}

function testGraphNeighbors(address) {
    group('Graph Service - Neighbors', () => {
        const depth = [1, 2][Math.floor(Math.random() * 2)];
        const limit = [10, 20][Math.floor(Math.random() * 2)];

        const start = Date.now();
        const res = http.get(
            `${GRAPH_URL}/api/v1/graph/address/${address}/neighbors?depth=${depth}&limit=${limit}`
        );
        const duration = Date.now() - start;

        graphLatency.add(duration);
        graphNeighborsLatency.add(duration);
        graphRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        graphErrors.add(isError);

        check(res, {
            'graph neighbors: status ok': (r) => [200, 404].includes(r.status),
            'graph neighbors: response time < 1000ms': (r) => duration < 1000,
        });
    });
}

function testBffAggregated(address) {
    group('BFF - Aggregated', () => {
        const start = Date.now();
        const res = http.get(`${BFF_URL}/api/v1/addresses/${address}`, { headers });
        const duration = Date.now() - start;

        bffLatency.add(duration);
        bffRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        bffErrors.add(isError);

        check(res, {
            'bff: status ok': (r) => [200, 404].includes(r.status),
            'bff: response time < 2000ms': (r) => duration < 2000,
        });
    });
}

// ============================================================================
// Helper Functions
// ============================================================================

function selectWeightedEndpoint() {
    const total = Object.values(ENDPOINT_WEIGHTS).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (const [endpoint, weight] of Object.entries(ENDPOINT_WEIGHTS)) {
        random -= weight;
        if (random <= 0) {
            return endpoint;
        }
    }
    return 'queryAddress'; // Default fallback
}

function randomThinkTime(min, max) {
    return min + Math.random() * (max - min);
}

// ============================================================================
// Summary Handler
// ============================================================================

export function handleSummary(data) {
    const summary = generateSummary(data);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    return {
        stdout: summary,
        [`tests/api/performance/results/baseline-${timestamp}.json`]: JSON.stringify(data, null, 2),
        'tests/api/performance/results/baseline-latest.json': JSON.stringify(data, null, 2),
    };
}

function generateSummary(data) {
    const m = data.metrics;
    const thresholds = data.thresholds || {};
    const passedThresholds = Object.values(thresholds).filter((t) => t.ok).length;
    const failedThresholds = Object.values(thresholds).filter((t) => !t.ok).length;

    const formatDuration = (metric, percentile) => {
        const val = metric?.values?.[`p(${percentile})`];
        return val !== undefined ? val.toFixed(2) : 'N/A';
    };

    const formatRate = (metric) => {
        const val = metric?.values?.rate;
        return val !== undefined ? (val * 100).toFixed(2) + '%' : 'N/A';
    };

    const formatCount = (metric) => {
        return metric?.values?.count || 0;
    };

    const checkSla = (actual, sla) => {
        if (actual === 'N/A') return '❓';
        return parseFloat(actual) <= sla ? '✅' : '❌';
    };

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        BASELINE PERFORMANCE REPORT                            ║
╠══════════════════════════════════════════════════════════════════════════════╣

 Test Duration: ${m.iteration_duration?.values?.avg?.toFixed(2) || 'N/A'}ms avg iteration
 Total Requests: ${formatCount(m.http_reqs)}
 Overall RPS: ${m.http_reqs?.values?.rate?.toFixed(2) || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
 SERVICE LATENCY (ms)                                    p50     p95     p99
────────────────────────────────────────────────────────────────────────────────

 QUERY SERVICE (SLA: p95<${slaDefinitions['query-service'].p95}, p99<${slaDefinitions['query-service'].p99})
   Overall:                                            ${formatDuration(m.query_service_duration, 50).padStart(7)} ${formatDuration(m.query_service_duration, 95).padStart(7)} ${formatDuration(m.query_service_duration, 99).padStart(7)}
   └─ Address Info:                                    ${formatDuration(m.query_address_duration, 50).padStart(7)} ${formatDuration(m.query_address_duration, 95).padStart(7)} ${formatDuration(m.query_address_duration, 99).padStart(7)}
   └─ Transfers:                                       ${formatDuration(m.query_transfers_duration, 50).padStart(7)} ${formatDuration(m.query_transfers_duration, 95).padStart(7)} ${formatDuration(m.query_transfers_duration, 99).padStart(7)}
   └─ Stats:                                           ${formatDuration(m.query_stats_duration, 50).padStart(7)} ${formatDuration(m.query_stats_duration, 95).padStart(7)} ${formatDuration(m.query_stats_duration, 99).padStart(7)}
   Status: ${checkSla(formatDuration(m.query_service_duration, 95), slaDefinitions['query-service'].p95)} p95  ${checkSla(formatDuration(m.query_service_duration, 99), slaDefinitions['query-service'].p99)} p99

 RISK ML SERVICE (SLA: p95<${slaDefinitions['risk-ml-service'].p95}, p99<${slaDefinitions['risk-ml-service'].p99})
   Overall:                                            ${formatDuration(m.risk_service_duration, 50).padStart(7)} ${formatDuration(m.risk_service_duration, 95).padStart(7)} ${formatDuration(m.risk_service_duration, 99).padStart(7)}
   └─ Single Score:                                    ${formatDuration(m.risk_score_duration, 50).padStart(7)} ${formatDuration(m.risk_score_duration, 95).padStart(7)} ${formatDuration(m.risk_score_duration, 99).padStart(7)}
   └─ Batch Score:                                     ${formatDuration(m.risk_batch_duration, 50).padStart(7)} ${formatDuration(m.risk_batch_duration, 95).padStart(7)} ${formatDuration(m.risk_batch_duration, 99).padStart(7)}
   Status: ${checkSla(formatDuration(m.risk_service_duration, 95), slaDefinitions['risk-ml-service'].p95)} p95  ${checkSla(formatDuration(m.risk_service_duration, 99), slaDefinitions['risk-ml-service'].p99)} p99

 GRAPH SERVICE (SLA: p95<${slaDefinitions['graph-service'].p95}, p99<${slaDefinitions['graph-service'].p99})
   Overall:                                            ${formatDuration(m.graph_service_duration, 50).padStart(7)} ${formatDuration(m.graph_service_duration, 95).padStart(7)} ${formatDuration(m.graph_service_duration, 99).padStart(7)}
   └─ Neighbors:                                       ${formatDuration(m.graph_neighbors_duration, 50).padStart(7)} ${formatDuration(m.graph_neighbors_duration, 95).padStart(7)} ${formatDuration(m.graph_neighbors_duration, 99).padStart(7)}
   Status: ${checkSla(formatDuration(m.graph_service_duration, 95), slaDefinitions['graph-service'].p95)} p95  ${checkSla(formatDuration(m.graph_service_duration, 99), slaDefinitions['graph-service'].p99)} p99

 BFF SERVICE (SLA: p95<${slaDefinitions['bff'].p95}, p99<${slaDefinitions['bff'].p99})
   Overall:                                            ${formatDuration(m.bff_duration, 50).padStart(7)} ${formatDuration(m.bff_duration, 95).padStart(7)} ${formatDuration(m.bff_duration, 99).padStart(7)}
   Status: ${checkSla(formatDuration(m.bff_duration, 95), slaDefinitions['bff'].p95)} p95  ${checkSla(formatDuration(m.bff_duration, 99), slaDefinitions['bff'].p99)} p99

────────────────────────────────────────────────────────────────────────────────
 ERROR RATES (SLA: <1%)
────────────────────────────────────────────────────────────────────────────────
   Query Service:  ${formatRate(m.query_service_errors).padStart(8)}  ${parseFloat(formatRate(m.query_service_errors)) < 1 ? '✅' : '❌'}
   Risk Service:   ${formatRate(m.risk_service_errors).padStart(8)}  ${parseFloat(formatRate(m.risk_service_errors)) < 1 ? '✅' : '❌'}
   Graph Service:  ${formatRate(m.graph_service_errors).padStart(8)}  ${parseFloat(formatRate(m.graph_service_errors)) < 1 ? '✅' : '❌'}
   BFF:            ${formatRate(m.bff_errors).padStart(8)}  ${parseFloat(formatRate(m.bff_errors)) < 1 ? '✅' : '❌'}

────────────────────────────────────────────────────────────────────────────────
 REQUEST DISTRIBUTION
────────────────────────────────────────────────────────────────────────────────
   Query Service:  ${formatCount(m.query_service_requests).toString().padStart(8)} requests
   Risk Service:   ${formatCount(m.risk_service_requests).toString().padStart(8)} requests
   Graph Service:  ${formatCount(m.graph_service_requests).toString().padStart(8)} requests
   BFF:            ${formatCount(m.bff_requests).toString().padStart(8)} requests

────────────────────────────────────────────────────────────────────────────────
 THRESHOLD SUMMARY
────────────────────────────────────────────────────────────────────────────────
   Passed: ${passedThresholds}
   Failed: ${failedThresholds}
   Status: ${failedThresholds === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}

╚══════════════════════════════════════════════════════════════════════════════╝

${failedThresholds > 0 ? generateFailedThresholds(thresholds) : ''}
`;
}

function generateFailedThresholds(thresholds) {
    const failed = Object.entries(thresholds)
        .filter(([, t]) => !t.ok)
        .map(([name]) => `   - ${name}`)
        .join('\n');

    return `
 FAILED THRESHOLDS:
${failed}
`;
}
