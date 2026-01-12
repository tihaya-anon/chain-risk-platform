/**
 * Mixed Workload Performance Test
 * Concurrent read/write operations to test data consistency under load
 * Owner: Worker C (Phase 15)
 *
 * Duration: 10 minutes
 * Load: 40 readers + 10 writers
 * Purpose: Test mixed workload behavior and resource contention
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { slaDefinitions } from '../config/thresholds.js';
import { getRandomAddress } from '../fixtures/addresses.js';
import { generateAlertRule, randomAddress } from '../fixtures/generators.js';

// Workload-specific metrics
const readLatency = new Trend('read_workload_duration', true);
const writeLatency = new Trend('write_workload_duration', true);
const readErrors = new Rate('read_workload_errors');
const writeErrors = new Rate('write_workload_errors');
const readRequests = new Counter('read_requests');
const writeRequests = new Counter('write_requests');

// Per-service metrics
const queryLatency = new Trend('query_service_duration', true);
const alertLatency = new Trend('alert_service_duration', true);
const riskLatency = new Trend('risk_service_duration', true);

export const options = {
    scenarios: {
        readers: {
            executor: 'constant-vus',
            vus: 40,
            duration: '10m',
            exec: 'readWorkload',
            tags: { workload: 'read' },
        },
        writers: {
            executor: 'constant-vus',
            vus: 10,
            duration: '10m',
            exec: 'writeWorkload',
            tags: { workload: 'write' },
        },
    },
    thresholds: {
        'http_req_duration{workload:read}': ['p(95)<300'],
        'http_req_duration{workload:write}': ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
        read_workload_duration: ['p(95)<300', 'p(99)<500'],
        write_workload_duration: ['p(95)<500', 'p(99)<800'],
        read_workload_errors: ['rate<0.01'],
        write_workload_errors: ['rate<0.02'],
    },
};

const QUERY_URL = getBaseUrl('query-service');
const ALERT_URL = getBaseUrl('alert-service');
const RISK_URL = getBaseUrl('risk-ml-service');
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Track created rules for cleanup
const createdRuleIds = [];

/**
 * Read Workload - 80% of traffic
 * Simulates typical user read patterns
 */
export function readWorkload() {
    const operations = [
        { name: 'address-lookup', weight: 40 },
        { name: 'transfers-list', weight: 30 },
        { name: 'risk-check', weight: 20 },
        { name: 'rules-list', weight: 10 },
    ];

    const op = selectWeighted(operations);

    switch (op) {
        case 'address-lookup':
            readAddressLookup();
            break;
        case 'transfers-list':
            readTransfersList();
            break;
        case 'risk-check':
            readRiskCheck();
            break;
        case 'rules-list':
            readRulesList();
            break;
    }

    sleep(randomThinkTime(0.3, 0.7));
}

/**
 * Write Workload - 20% of traffic
 * Simulates administrative write operations
 */
export function writeWorkload() {
    const operations = [
        { name: 'create-rule', weight: 40 },
        { name: 'update-rule', weight: 30 },
        { name: 'delete-rule', weight: 30 },
    ];

    const op = selectWeighted(operations);

    switch (op) {
        case 'create-rule':
            writeCreateRule();
            break;
        case 'update-rule':
            writeUpdateRule();
            break;
        case 'delete-rule':
            writeDeleteRule();
            break;
    }

    sleep(randomThinkTime(1, 2));
}

// Read Operations

function readAddressLookup() {
    group('Read - Address Lookup', () => {
        const address = getRandomAddress();
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}`, {
            tags: { workload: 'read' },
        });
        const duration = Date.now() - start;

        readLatency.add(duration);
        queryLatency.add(duration);
        readRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        readErrors.add(isError);

        check(res, {
            'read address: status ok': (r) => [200, 404].includes(r.status),
        });
    });
}

function readTransfersList() {
    group('Read - Transfers List', () => {
        const address = getRandomAddress();
        const pageSize = [10, 20, 50][Math.floor(Math.random() * 3)];
        const start = Date.now();
        const res = http.get(`${QUERY_URL}/api/v1/addresses/${address}/transfers?pageSize=${pageSize}`, {
            tags: { workload: 'read' },
        });
        const duration = Date.now() - start;

        readLatency.add(duration);
        queryLatency.add(duration);
        readRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        readErrors.add(isError);

        check(res, {
            'read transfers: status ok': (r) => [200, 404].includes(r.status),
        });
    });
}

function readRiskCheck() {
    group('Read - Risk Check', () => {
        const address = getRandomAddress();
        const payload = JSON.stringify({
            address: address,
            network: 'ethereum',
            include_factors: false,
        });
        const start = Date.now();
        const res = http.post(`${RISK_URL}/api/v1/risk/score`, payload, {
            headers: JSON_HEADERS,
            tags: { workload: 'read' },
        });
        const duration = Date.now() - start;

        readLatency.add(duration);
        riskLatency.add(duration);
        readRequests.add(1);

        const isError = res.status >= 400;
        readErrors.add(isError);

        check(res, {
            'risk check: status 200': (r) => r.status === 200,
        });
    });
}

function readRulesList() {
    group('Read - Rules List', () => {
        const start = Date.now();
        const res = http.get(`${ALERT_URL}/api/v1/rules?page=1&pageSize=20`, {
            tags: { workload: 'read' },
        });
        const duration = Date.now() - start;

        readLatency.add(duration);
        alertLatency.add(duration);
        readRequests.add(1);

        const isError = res.status >= 400;
        readErrors.add(isError);

        check(res, {
            'read rules: status 200': (r) => r.status === 200,
        });
    });
}

// Write Operations

function writeCreateRule() {
    group('Write - Create Rule', () => {
        const rule = generateAlertRule({
            name: `perf-test-rule-${Date.now()}-${__VU}`,
            enabled: false, // Disabled to avoid triggering alerts
        });

        const start = Date.now();
        const res = http.post(`${ALERT_URL}/api/v1/rules`, JSON.stringify(rule), {
            headers: JSON_HEADERS,
            tags: { workload: 'write' },
        });
        const duration = Date.now() - start;

        writeLatency.add(duration);
        alertLatency.add(duration);
        writeRequests.add(1);

        const isError = res.status !== 201 && res.status !== 200;
        writeErrors.add(isError);

        check(res, {
            'create rule: status ok': (r) => [200, 201].includes(r.status),
        });

        // Store rule ID for cleanup
        if (res.status === 201 || res.status === 200) {
            try {
                const body = res.json();
                if (body.id) {
                    createdRuleIds.push(body.id);
                }
            } catch (e) {
                // Ignore JSON parse errors
            }
        }
    });
}

function writeUpdateRule() {
    group('Write - Update Rule', () => {
        // First get existing rules
        const listRes = http.get(`${ALERT_URL}/api/v1/rules?pageSize=5`, {
            tags: { workload: 'write' },
        });

        if (listRes.status !== 200) {
            writeErrors.add(true);
            return;
        }

        let rules = [];
        try {
            const body = listRes.json();
            rules = body.data || body.rules || [];
        } catch (e) {
            writeErrors.add(true);
            return;
        }

        if (rules.length === 0) {
            writeErrors.add(false);
            return;
        }

        const rule = rules[Math.floor(Math.random() * rules.length)];
        const updatePayload = JSON.stringify({
            description: `Updated by perf test at ${new Date().toISOString()}`,
        });

        const start = Date.now();
        const res = http.patch(`${ALERT_URL}/api/v1/rules/${rule.id}`, updatePayload, {
            headers: JSON_HEADERS,
            tags: { workload: 'write' },
        });
        const duration = Date.now() - start;

        writeLatency.add(duration);
        alertLatency.add(duration);
        writeRequests.add(1);

        const isError = res.status >= 400;
        writeErrors.add(isError);

        check(res, {
            'update rule: status ok': (r) => [200, 204].includes(r.status),
        });
    });
}

function writeDeleteRule() {
    group('Write - Delete Rule', () => {
        // Only delete rules we created
        if (createdRuleIds.length === 0) {
            writeErrors.add(false);
            return;
        }

        const ruleId = createdRuleIds.pop();
        const start = Date.now();
        const res = http.del(`${ALERT_URL}/api/v1/rules/${ruleId}`, null, {
            tags: { workload: 'write' },
        });
        const duration = Date.now() - start;

        writeLatency.add(duration);
        alertLatency.add(duration);
        writeRequests.add(1);

        const isError = res.status >= 400 && res.status !== 404;
        writeErrors.add(isError);

        check(res, {
            'delete rule: status ok': (r) => [200, 204, 404].includes(r.status),
        });
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
        [`tests/api/performance/results/mixed-${timestamp}.json`]: JSON.stringify(data, null, 2),
        'tests/api/performance/results/mixed-summary.json': JSON.stringify(data, null, 2),
    };
}

function generateReport(data) {
    const m = data.metrics;
    const formatDuration = (metric, pct) => metric?.values?.[`p(${pct})`]?.toFixed(2) || 'N/A';
    const formatRate = (metric) => ((metric?.values?.rate || 0) * 100).toFixed(2);
    const formatCount = (metric) => metric?.values?.count || 0;

    const readRatio = formatCount(m.read_requests);
    const writeRatio = formatCount(m.write_requests);
    const total = readRatio + writeRatio;
    const readPct = total > 0 ? ((readRatio / total) * 100).toFixed(1) : '0';
    const writePct = total > 0 ? ((writeRatio / total) * 100).toFixed(1) : '0';

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                       MIXED WORKLOAD TEST REPORT                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
 Duration: 10 minutes | Readers: 40 VUs | Writers: 10 VUs

 WORKLOAD DISTRIBUTION
 ───────────────────────────────────────────────────────────────────────────────
   Read Operations:    ${readRatio} (${readPct}%)
   Write Operations:   ${writeRatio} (${writePct}%)
   Total:              ${total}

 READ WORKLOAD PERFORMANCE
 ───────────────────────────────────────────────────────────────────────────────
   P50:                ${formatDuration(m.read_workload_duration, 50)}ms
   P95:                ${formatDuration(m.read_workload_duration, 95)}ms   (SLA: <300ms)
   P99:                ${formatDuration(m.read_workload_duration, 99)}ms   (SLA: <500ms)
   Error Rate:         ${formatRate(m.read_workload_errors)}%

 WRITE WORKLOAD PERFORMANCE
 ───────────────────────────────────────────────────────────────────────────────
   P50:                ${formatDuration(m.write_workload_duration, 50)}ms
   P95:                ${formatDuration(m.write_workload_duration, 95)}ms   (SLA: <500ms)
   P99:                ${formatDuration(m.write_workload_duration, 99)}ms   (SLA: <800ms)
   Error Rate:         ${formatRate(m.write_workload_errors)}%

 PER-SERVICE LATENCY (p95)
 ───────────────────────────────────────────────────────────────────────────────
   Query Service:      ${formatDuration(m.query_service_duration, 95)}ms
   Alert Service:      ${formatDuration(m.alert_service_duration, 95)}ms
   Risk Service:       ${formatDuration(m.risk_service_duration, 95)}ms

 THRESHOLD RESULTS
 ───────────────────────────────────────────────────────────────────────────────
   Passed: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}
   Failed: ${Object.values(data.thresholds || {}).filter(t => !t.ok).length}

╚══════════════════════════════════════════════════════════════════════════════╝
`;
}
