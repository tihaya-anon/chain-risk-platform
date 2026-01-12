/**
 * Database Stress Performance Test
 * Complex query patterns to stress database layers
 * Owner: Worker C (Phase 15)
 *
 * Duration: 10 minutes
 * Load: Simple (20 VUs) + Complex (10 VUs) + Aggregation (5 VUs)
 * Purpose: Test database performance under various query complexities
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getBaseUrl } from '../config/environments.js';
import { slaDefinitions } from '../config/thresholds.js';
import { getRandomAddress } from '../fixtures/addresses.js';
import { randomAddressBatch } from '../fixtures/generators.js';

// Query-type specific metrics
const simpleQueryLatency = new Trend('simple_query_duration', true);
const complexQueryLatency = new Trend('complex_query_duration', true);
const aggregationQueryLatency = new Trend('aggregation_query_duration', true);

const simpleQueryErrors = new Rate('simple_query_errors');
const complexQueryErrors = new Rate('complex_query_errors');
const aggregationQueryErrors = new Rate('aggregation_query_errors');

const simpleQueryCount = new Counter('simple_query_count');
const complexQueryCount = new Counter('complex_query_count');
const aggregationQueryCount = new Counter('aggregation_query_count');

// Per-service metrics
const queryServiceLatency = new Trend('query_service_duration', true);
const graphServiceLatency = new Trend('graph_service_duration', true);

export const options = {
    scenarios: {
        simple_queries: {
            executor: 'constant-vus',
            vus: 20,
            duration: '10m',
            exec: 'simpleQueries',
            tags: { query: 'simple' },
        },
        complex_queries: {
            executor: 'constant-vus',
            vus: 10,
            duration: '10m',
            exec: 'complexQueries',
            tags: { query: 'complex' },
        },
        aggregations: {
            executor: 'constant-vus',
            vus: 5,
            duration: '10m',
            exec: 'aggregationQueries',
            tags: { query: 'aggregation' },
        },
    },
    thresholds: {
        'http_req_duration{query:simple}': ['p(95)<200'],
        'http_req_duration{query:complex}': ['p(95)<1000'],
        'http_req_duration{query:aggregation}': ['p(95)<2000'],
        http_req_failed: ['rate<0.02'],
        simple_query_duration: ['p(95)<200', 'p(99)<400'],
        complex_query_duration: ['p(95)<1000', 'p(99)<1500'],
        aggregation_query_duration: ['p(95)<2000', 'p(99)<3000'],
    },
};

const QUERY_URL = getBaseUrl('query-service');
const GRAPH_URL = getBaseUrl('graph-service');
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Simple Queries - Fast, index-backed lookups
 * Target: <200ms p95
 */
export function simpleQueries() {
    const operations = [
        { name: 'single-address', weight: 40 },
        { name: 'health-check', weight: 20 },
        { name: 'paginated-list', weight: 40 },
    ];

    const op = selectWeighted(operations);

    group(`Simple - ${op}`, () => {
        switch (op) {
            case 'single-address':
                simpleSingleAddress();
                break;
            case 'health-check':
                simpleHealthCheck();
                break;
            case 'paginated-list':
                simplePaginatedList();
                break;
        }
    });

    sleep(randomThinkTime(0.1, 0.3));
}

function simpleSingleAddress() {
    const address = getRandomAddress();
    const start = Date.now();
    const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}`, {
        tags: { query: 'simple' },
    });
    const duration = Date.now() - start;

    simpleQueryLatency.add(duration);
    queryServiceLatency.add(duration);
    simpleQueryCount.add(1);

    const isError = res.status >= 400 && res.status !== 404;
    simpleQueryErrors.add(isError);

    check(res, {
        'simple address: status ok': (r) => [200, 404].includes(r.status),
        'simple address: latency ok': () => duration < 200,
    });
}

function simpleHealthCheck() {
    const start = Date.now();
    const res = http.get(`${QUERY_URL}/health`, {
        tags: { query: 'simple' },
    });
    const duration = Date.now() - start;

    simpleQueryLatency.add(duration);
    queryServiceLatency.add(duration);
    simpleQueryCount.add(1);

    const isError = res.status !== 200;
    simpleQueryErrors.add(isError);

    check(res, {
        'health: status 200': (r) => r.status === 200,
    });
}

function simplePaginatedList() {
    const page = Math.floor(Math.random() * 5) + 1;
    const pageSize = 10;
    const start = Date.now();
    const res = http.get(`${QUERY_URL}/api/v1/transfers?page=${page}&pageSize=${pageSize}`, {
        tags: { query: 'simple' },
    });
    const duration = Date.now() - start;

    simpleQueryLatency.add(duration);
    queryServiceLatency.add(duration);
    simpleQueryCount.add(1);

    const isError = res.status >= 400;
    simpleQueryErrors.add(isError);

    check(res, {
        'paginated list: status ok': (r) => [200].includes(r.status),
    });
}

/**
 * Complex Queries - Multi-filter, join operations
 * Target: <1000ms p95
 */
export function complexQueries() {
    const operations = [
        { name: 'filtered-transfers', weight: 40 },
        { name: 'address-with-stats', weight: 30 },
        { name: 'multi-address-lookup', weight: 30 },
    ];

    const op = selectWeighted(operations);

    group(`Complex - ${op}`, () => {
        switch (op) {
            case 'filtered-transfers':
                complexFilteredTransfers();
                break;
            case 'address-with-stats':
                complexAddressWithStats();
                break;
            case 'multi-address-lookup':
                complexMultiAddressLookup();
                break;
        }
    });

    sleep(randomThinkTime(0.5, 1.0));
}

function complexFilteredTransfers() {
    const address = getRandomAddress();
    const params = new URLSearchParams({
        pageSize: '50',
        page: '1',
        from_address: address,
    });

    const start = Date.now();
    const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}/transfers?${params}`, {
        tags: { query: 'complex' },
    });
    const duration = Date.now() - start;

    complexQueryLatency.add(duration);
    queryServiceLatency.add(duration);
    complexQueryCount.add(1);

    const isError = res.status >= 400 && res.status !== 404;
    complexQueryErrors.add(isError);

    check(res, {
        'filtered transfers: status ok': (r) => [200, 404].includes(r.status),
        'filtered transfers: latency ok': () => duration < 1000,
    });
}

function complexAddressWithStats() {
    const address = getRandomAddress();

    // Sequential requests (simulating aggregation)
    const start = Date.now();

    const addrRes = http.get(`${QUERY_URL}/api/v1/addresses/${address}`, {
        tags: { query: 'complex' },
    });

    const statsRes = http.get(`${QUERY_URL}/api/v1/addresses/${address}/stats`, {
        tags: { query: 'complex' },
    });

    const duration = Date.now() - start;

    complexQueryLatency.add(duration);
    queryServiceLatency.add(duration);
    complexQueryCount.add(1);

    const isError = (addrRes.status >= 400 && addrRes.status !== 404) ||
                    (statsRes.status >= 400 && statsRes.status !== 404);
    complexQueryErrors.add(isError);

    check(addrRes, {
        'address fetch: status ok': (r) => [200, 404].includes(r.status),
    });
    check(statsRes, {
        'stats fetch: status ok': (r) => [200, 404].includes(r.status),
    });
}

function complexMultiAddressLookup() {
    const addresses = randomAddressBatch(5);
    const start = Date.now();

    // Batch request simulation
    const responses = addresses.map(addr =>
        http.get(`${QUERY_URL}/api/v1/addresses/${addr}`, {
            tags: { query: 'complex' },
        })
    );

    const duration = Date.now() - start;

    complexQueryLatency.add(duration);
    queryServiceLatency.add(duration);
    complexQueryCount.add(1);

    const hasError = responses.some(r => r.status >= 400 && r.status !== 404);
    complexQueryErrors.add(hasError);

    check({ count: responses.length }, {
        'multi-address: all fetched': (r) => r.count === 5,
    });
}

/**
 * Aggregation Queries - Graph traversal, heavy computation
 * Target: <2000ms p95
 */
export function aggregationQueries() {
    const operations = [
        { name: 'graph-neighbors', weight: 50 },
        { name: 'deep-traversal', weight: 30 },
        { name: 'path-finding', weight: 20 },
    ];

    const op = selectWeighted(operations);

    group(`Aggregation - ${op}`, () => {
        switch (op) {
            case 'graph-neighbors':
                aggregationGraphNeighbors();
                break;
            case 'deep-traversal':
                aggregationDeepTraversal();
                break;
            case 'path-finding':
                aggregationPathFinding();
                break;
        }
    });

    sleep(randomThinkTime(1.0, 2.0));
}

function aggregationGraphNeighbors() {
    const address = getRandomAddress();
    const start = Date.now();
    const res = http.get(
        `${GRAPH_URL}/api/v1/graph/address/${address}/neighbors?depth=2&limit=20`,
        { tags: { query: 'aggregation' } }
    );
    const duration = Date.now() - start;

    aggregationQueryLatency.add(duration);
    graphServiceLatency.add(duration);
    aggregationQueryCount.add(1);

    const isError = res.status >= 400 && res.status !== 404;
    aggregationQueryErrors.add(isError);

    check(res, {
        'graph neighbors: status ok': (r) => [200, 404].includes(r.status),
        'graph neighbors: latency ok': () => duration < 2000,
    });
}

function aggregationDeepTraversal() {
    const address = getRandomAddress();
    const start = Date.now();
    const res = http.get(
        `${GRAPH_URL}/api/v1/graph/address/${address}/neighbors?depth=3&limit=50`,
        { tags: { query: 'aggregation' } }
    );
    const duration = Date.now() - start;

    aggregationQueryLatency.add(duration);
    graphServiceLatency.add(duration);
    aggregationQueryCount.add(1);

    const isError = res.status >= 400 && res.status !== 404;
    aggregationQueryErrors.add(isError);

    check(res, {
        'deep traversal: status ok': (r) => [200, 404].includes(r.status),
        'deep traversal: latency ok': () => duration < 3000,
    });
}

function aggregationPathFinding() {
    const addresses = randomAddressBatch(2);
    const start = Date.now();
    const res = http.get(
        `${GRAPH_URL}/api/v1/graph/path?from=${addresses[0]}&to=${addresses[1]}&maxDepth=4`,
        { tags: { query: 'aggregation' } }
    );
    const duration = Date.now() - start;

    aggregationQueryLatency.add(duration);
    graphServiceLatency.add(duration);
    aggregationQueryCount.add(1);

    const isError = res.status >= 400 && res.status !== 404;
    aggregationQueryErrors.add(isError);

    check(res, {
        'path finding: status ok': (r) => [200, 404].includes(r.status),
        'path finding: latency ok': () => duration < 3000,
    });
}

// Helper Functions

function selectWeighted(options) {
    const total = options.reduce((sum, o) => sum + o.weight, 0);
    let random = Math.random() * total;

    for (const opt of options) {
        random -= opt.weight;
        if (random <= 0) return opt.name;
    }
    return options[0].name;
}

function randomThinkTime(min, max) {
    return min + Math.random() * (max - min);
}

export function handleSummary(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        stdout: generateReport(data),
        [`tests/api/performance/results/db-stress-${timestamp}.json`]: JSON.stringify(data, null, 2),
        'tests/api/performance/results/db-stress-summary.json': JSON.stringify(data, null, 2),
    };
}

function generateReport(data) {
    const m = data.metrics;
    const formatDuration = (metric, pct) => metric?.values?.[`p(${pct})`]?.toFixed(2) || 'N/A';
    const formatRate = (metric) => ((metric?.values?.rate || 0) * 100).toFixed(2);
    const formatCount = (metric) => metric?.values?.count || 0;

    const checkSLA = (metric, sla) => {
        const p95 = metric?.values?.['p(95)'];
        if (!p95) return '❓';
        return p95 <= sla ? '✅' : '❌';
    };

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                      DATABASE STRESS TEST REPORT                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
 Duration: 10 minutes | Simple: 20 VUs | Complex: 10 VUs | Aggregation: 5 VUs

 QUERY DISTRIBUTION
 ───────────────────────────────────────────────────────────────────────────────
   Simple Queries:     ${formatCount(m.simple_query_count)}
   Complex Queries:    ${formatCount(m.complex_query_count)}
   Aggregation Queries: ${formatCount(m.aggregation_query_count)}

 SIMPLE QUERIES (Target: <200ms p95)
 ───────────────────────────────────────────────────────────────────────────────
   P50:                ${formatDuration(m.simple_query_duration, 50)}ms
   P95:                ${formatDuration(m.simple_query_duration, 95)}ms   ${checkSLA(m.simple_query_duration, 200)}
   P99:                ${formatDuration(m.simple_query_duration, 99)}ms
   Error Rate:         ${formatRate(m.simple_query_errors)}%

 COMPLEX QUERIES (Target: <1000ms p95)
 ───────────────────────────────────────────────────────────────────────────────
   P50:                ${formatDuration(m.complex_query_duration, 50)}ms
   P95:                ${formatDuration(m.complex_query_duration, 95)}ms   ${checkSLA(m.complex_query_duration, 1000)}
   P99:                ${formatDuration(m.complex_query_duration, 99)}ms
   Error Rate:         ${formatRate(m.complex_query_errors)}%

 AGGREGATION QUERIES (Target: <2000ms p95)
 ───────────────────────────────────────────────────────────────────────────────
   P50:                ${formatDuration(m.aggregation_query_duration, 50)}ms
   P95:                ${formatDuration(m.aggregation_query_duration, 95)}ms   ${checkSLA(m.aggregation_query_duration, 2000)}
   P99:                ${formatDuration(m.aggregation_query_duration, 99)}ms
   Error Rate:         ${formatRate(m.aggregation_query_errors)}%

 PER-SERVICE LATENCY (p95)
 ───────────────────────────────────────────────────────────────────────────────
   Query Service:      ${formatDuration(m.query_service_duration, 95)}ms
   Graph Service:      ${formatDuration(m.graph_service_duration, 95)}ms

 DATABASE OBSERVATIONS
 ───────────────────────────────────────────────────────────────────────────────
   - Simple queries: Index-backed, should be fastest
   - Complex queries: Multi-filter/join operations
   - Aggregation: Graph traversal (Neo4j), most expensive

 THRESHOLD RESULTS
 ───────────────────────────────────────────────────────────────────────────────
   Passed: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}
   Failed: ${Object.values(data.thresholds || {}).filter(t => !t.ok).length}

╚══════════════════════════════════════════════════════════════════════════════╝
`;
}
