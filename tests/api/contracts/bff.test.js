/**
 * BFF Contract Tests
 * Validates aggregated API responses match OpenAPI spec
 * Owner: W4
 *
 * Endpoints covered:
 * - Auth: login, profile
 * - Addresses: info, transfers, stats
 * - Transfers: list, by txHash
 * - Risk: score, batch, rules
 * - Graph: address, neighbors, tags, cluster, path, search, propagate
 * - Alerts: rules CRUD, history, stats, subscriptions
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import {
    validateSchema,
    hasFields,
    isInRange,
    isValidRiskLevel,
    isValidSeverity,
} from '../helpers/schema-validator.js';
import { defaultTestAddress, testAddresses, invalidAddresses } from '../fixtures/addresses.js';
import {
    generateLoginRequest,
    generateRiskScoreRequest,
    generateBatchRiskRequest,
    generateAlertRule,
    generateAddTagRequest,
} from '../fixtures/generators.js';
import * as schemas from '../schemas/bff.js';

export const options = contractTestOptions;

const BASE_URL = getBaseUrl('bff');
const headers = getBffHeaders();
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

export default function () {
    // ===== Auth Endpoints =====
    group('POST /api/v1/auth/login - valid credentials', () => {
        const payload = generateLoginRequest();
        const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify(payload), {
            headers: { 'Content-Type': 'application/json' },
        });

        check(res, {
            'status 200 or 401': (r) => [200, 401].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.LoginResponse);
            check(null, {
                'response matches LoginResponse schema': () => validation.valid,
            });
            check(body, {
                'has accessToken': (b) => typeof b.accessToken === 'string',
                'has tokenType': (b) => b.tokenType === 'Bearer',
                'has expiresIn': (b) => 'expiresIn' in b,
            });
        }
    });

    group('POST /api/v1/auth/login - invalid credentials', () => {
        const payload = { username: 'invalid', password: 'wrong' };
        const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify(payload), {
            headers: { 'Content-Type': 'application/json' },
        });

        check(res, {
            'status 401 for invalid credentials': (r) => r.status === 401,
        });
    });

    group('POST /api/v1/auth/login - missing fields', () => {
        const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json' },
        });

        check(res, {
            'status 400 or 401': (r) => [400, 401].includes(r.status),
        });
    });

    group('GET /api/v1/auth/profile', () => {
        const res = http.get(`${BASE_URL}/api/v1/auth/profile`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.UserProfileResponse);
            check(null, {
                'response matches UserProfileResponse schema': () => validation.valid,
            });
            check(body, {
                'has id': (b) => 'id' in b,
                'has username': (b) => typeof b.username === 'string',
                'has valid role': (b) => ['admin', 'user'].includes(b.role),
            });
        }
    });

    group('GET /api/v1/auth/profile - missing headers', () => {
        const res = http.get(`${BASE_URL}/api/v1/auth/profile`);

        check(res, {
            'status 401 without headers': (r) => r.status === 401,
        });
    });

    // ===== Address Endpoints =====
    group('GET /api/v1/addresses/{address}', () => {
        const res = http.get(`${BASE_URL}/api/v1/addresses/${defaultTestAddress}`, { headers });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressInfoResponse);
            check(null, {
                'response matches AddressInfoResponse schema': () => validation.valid,
            });
            check(body, {
                'address matches request': (b) =>
                    b.address?.toLowerCase() === defaultTestAddress.toLowerCase(),
            });
        }
    });

    group('GET /api/v1/addresses/{address} - with network param', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}?network=ethereum`,
            { headers }
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('GET /api/v1/addresses/{address}/transfers', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}/transfers?page=1&pageSize=10`,
            { headers }
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.PaginatedTransfersResponse);
            check(null, {
                'response matches PaginatedTransfersResponse schema': () => validation.valid,
            });
            check(body, {
                'has items array': (b) => Array.isArray(b.items),
                'has pagination': (b) => 'pagination' in b,
                'pagination has page': (b) => b.pagination?.page === 1,
                'pagination has pageSize': (b) => b.pagination?.pageSize === 10,
            });
        }
    });

    group('GET /api/v1/addresses/{address}/stats', () => {
        const res = http.get(`${BASE_URL}/api/v1/addresses/${defaultTestAddress}/stats`, {
            headers,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has totalValueSent': (b) => 'totalValueSent' in b,
                'has totalValueReceived': (b) => 'totalValueReceived' in b,
            });
        }
    });

    // ===== Transfers Endpoints =====
    group('GET /api/v1/transfers - list transfers', () => {
        const res = http.get(`${BASE_URL}/api/v1/transfers?page=1&pageSize=10`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has items array': (b) => Array.isArray(b.items),
                'has pagination': (b) => 'pagination' in b,
            });
        }
    });

    group('GET /api/v1/transfers - filter by address', () => {
        const res = http.get(`${BASE_URL}/api/v1/transfers?address=${defaultTestAddress}`, {
            headers,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    group('GET /api/v1/transfers/tx/{txHash}', () => {
        const fakeTxHash = '0x' + '0'.repeat(64);
        const res = http.get(`${BASE_URL}/api/v1/transfers/tx/${fakeTxHash}`, { headers });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
        }
    });

    // ===== Risk Endpoints =====
    group('POST /api/v1/risk/score', () => {
        const payload = generateRiskScoreRequest(defaultTestAddress);
        const res = http.post(`${BASE_URL}/api/v1/risk/score`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.RiskScoreResponse);
            check(null, {
                'response matches RiskScoreResponse schema': () => validation.valid,
            });
            check(body, {
                'has address': (b) => 'address' in b,
                'has riskScore': (b) => 'riskScore' in b,
                'riskScore in range [0,1]': (b) => isInRange(b.riskScore, 0, 1),
                'has valid riskLevel': (b) => isValidRiskLevel(b.riskLevel),
                'has factors array': (b) => Array.isArray(b.factors),
                'has evaluatedAt': (b) => 'evaluatedAt' in b,
            });
        }
    });

    group('POST /api/v1/risk/score - invalid address', () => {
        const payload = { address: 'invalid', network: 'ethereum' };
        const res = http.post(`${BASE_URL}/api/v1/risk/score`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 400 for invalid address': (r) => r.status === 400,
        });
    });

    group('POST /api/v1/risk/score/batch', () => {
        const addresses = [testAddresses.test1, testAddresses.test2];
        const payload = generateBatchRiskRequest(addresses);
        const res = http.post(`${BASE_URL}/api/v1/risk/score/batch`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.BatchRiskScoreResponse);
            check(null, {
                'response matches BatchRiskScoreResponse schema': () => validation.valid,
            });
            check(body, {
                'has results array': (b) => Array.isArray(b.results),
                'has total': (b) => typeof b.total === 'number',
                'has failed': (b) => typeof b.failed === 'number',
                'total matches request': (b) => b.total === addresses.length,
            });
        }
    });

    group('GET /api/v1/risk/rules', () => {
        const res = http.get(`${BASE_URL}/api/v1/risk/rules`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
        }
    });

    // ===== Graph Endpoints =====
    group('GET /api/v1/graph/address/{address}', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}`, {
            headers,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('GET /api/v1/graph/address/{address}/neighbors', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/neighbors?depth=1&limit=10`,
            { headers }
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressNeighborsResponse);
            check(null, {
                'response matches AddressNeighborsResponse schema': () => validation.valid,
            });
            check(body, {
                'has address': (b) => 'address' in b,
                'has nodes array': (b) => Array.isArray(b.nodes),
                'has edges array': (b) => Array.isArray(b.edges),
            });
        }
    });

    group('GET /api/v1/graph/address/{address}/tags', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags`, {
            headers,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
        }
    });

    group('POST /api/v1/graph/address/{address}/tags', () => {
        const payload = generateAddTagRequest(['bff-test-tag']);
        const res = http.post(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags`,
            JSON.stringify(payload),
            { headers: jsonHeaders }
        );

        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    group('DELETE /api/v1/graph/address/{address}/tags/{tag}', () => {
        const res = http.del(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags/bff-test-tag`,
            null,
            { headers }
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('GET /api/v1/graph/address/{address}/cluster', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/cluster`, {
            headers,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.ClusterResponse);
            check(null, {
                'response matches ClusterResponse schema': () => validation.valid,
            });
        }
    });

    group('GET /api/v1/graph/path/{from}/{to}', () => {
        const from = testAddresses.test1;
        const to = testAddresses.test2;
        const res = http.get(`${BASE_URL}/api/v1/graph/path/${from}/${to}?maxDepth=3`, {
            headers,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.PathResponse);
            check(null, {
                'response matches PathResponse schema': () => validation.valid,
            });
            check(body, {
                'has found': (b) => typeof b.found === 'boolean',
                'has fromAddress': (b) => 'fromAddress' in b,
                'has toAddress': (b) => 'toAddress' in b,
            });
        }
    });

    group('GET /api/v1/graph/cluster/{clusterId}', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/cluster/test-cluster-id`, { headers });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('POST /api/v1/graph/cluster/run', () => {
        const res = http.post(`${BASE_URL}/api/v1/graph/cluster/run`, null, {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.ClusteringResultResponse);
            check(null, {
                'response matches ClusteringResultResponse schema': () => validation.valid,
            });
        }
    });

    group('POST /api/v1/graph/cluster/manual', () => {
        const payload = { addresses: [testAddresses.test1, testAddresses.test2] };
        const res = http.post(`${BASE_URL}/api/v1/graph/cluster/manual`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    group('GET /api/v1/graph/search/tag/{tag}', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/search/tag/exchange?limit=10`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
        }
    });

    group('GET /api/v1/graph/search/high-risk', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/search/high-risk?threshold=0.6&limit=10`, {
            headers,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
        }
    });

    group('POST /api/v1/graph/propagate', () => {
        const res = http.post(`${BASE_URL}/api/v1/graph/propagate`, null, {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.PropagationResultResponse);
            check(null, {
                'response matches PropagationResultResponse schema': () => validation.valid,
            });
        }
    });

    group('POST /api/v1/graph/propagate/{address}', () => {
        const res = http.post(`${BASE_URL}/api/v1/graph/propagate/${defaultTestAddress}`, null, {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    // ===== Alert Rules Endpoints =====
    group('GET /api/v1/alerts/rules', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/rules`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
            if (body.length > 0) {
                const validation = validateSchema(body[0], schemas.AlertRuleResponse);
                check(null, {
                    'items match AlertRuleResponse schema': () => validation.valid,
                });
            }
        }
    });

    group('GET /api/v1/alerts/rules - filter enabled', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/rules?enabled=true`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'all rules are enabled': () => body.every((r) => r.enabled === true),
            });
        }
    });

    group('POST /api/v1/alerts/rules - create rule', () => {
        const payload = generateAlertRule();
        const res = http.post(`${BASE_URL}/api/v1/alerts/rules`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 201 or 200': (r) => [200, 201].includes(r.status),
        });

        if ([200, 201].includes(res.status)) {
            const body = res.json();
            check(body, {
                'has id': (b) => 'id' in b,
                'name matches': (b) => b.name === payload.name,
            });
        }
    });

    group('GET /api/v1/alerts/rules/{id}', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/rules/1`, { headers });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('PUT /api/v1/alerts/rules/{id}', () => {
        const payload = { name: 'Updated Rule', description: 'Updated description' };
        const res = http.put(`${BASE_URL}/api/v1/alerts/rules/1`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('POST /api/v1/alerts/rules/{id}/enable', () => {
        const res = http.post(`${BASE_URL}/api/v1/alerts/rules/1/enable`, null, {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('POST /api/v1/alerts/rules/{id}/disable', () => {
        const res = http.post(`${BASE_URL}/api/v1/alerts/rules/1/disable`, null, {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    // ===== Alert History Endpoints =====
    group('GET /api/v1/alerts/history', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/history?page=1&pageSize=10`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AlertHistoryListResponse);
            check(null, {
                'response matches AlertHistoryListResponse schema': () => validation.valid,
            });
            check(body, {
                'has data array': (b) => Array.isArray(b.data),
                'has total': (b) => typeof b.total === 'number',
                'has page': (b) => b.page === 1,
                'has pageSize': (b) => b.pageSize === 10,
            });
        }
    });

    group('GET /api/v1/alerts/history - with filters', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/alerts/history?severity=high&status=pending`,
            { headers }
        );

        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    group('GET /api/v1/alerts/history/{id}', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/history/1`, { headers });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AlertHistoryResponse);
            check(null, {
                'response matches AlertHistoryResponse schema': () => validation.valid,
            });
        }
    });

    group('POST /api/v1/alerts/history/{id}/acknowledge', () => {
        const res = http.post(`${BASE_URL}/api/v1/alerts/history/1/acknowledge`, null, {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    // ===== Alert Stats Endpoint =====
    group('GET /api/v1/alerts/stats', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/stats`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AlertStatsResponse);
            check(null, {
                'response matches AlertStatsResponse schema': () => validation.valid,
            });
            check(body, {
                'has total': (b) => typeof b.total === 'number',
                'has bySeverity': (b) => typeof b.bySeverity === 'object',
                'has byStatus': (b) => typeof b.byStatus === 'object',
                'has byType': (b) => typeof b.byType === 'object',
                'has averagePerHour': (b) => typeof b.averagePerHour === 'number',
            });
        }
    });

    group('GET /api/v1/alerts/stats - custom hours', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/stats?hours=48`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    // ===== Subscriptions Endpoints =====
    group('GET /api/v1/alerts/subscriptions', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/subscriptions`, { headers });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
            if (body.length > 0) {
                const validation = validateSchema(body[0], schemas.SubscriptionResponse);
                check(null, {
                    'items match SubscriptionResponse schema': () => validation.valid,
                });
            }
        }
    });

    group('POST /api/v1/alerts/subscriptions - create subscription', () => {
        const payload = {
            userId: 'test-user',
            channelType: 'webhook',
            channelConfig: { url: 'https://example.com/webhook' },
            enabled: true,
        };
        const res = http.post(
            `${BASE_URL}/api/v1/alerts/subscriptions`,
            JSON.stringify(payload),
            { headers: jsonHeaders }
        );

        check(res, {
            'status 201 or 200': (r) => [200, 201].includes(r.status),
        });
    });

    group('DELETE /api/v1/alerts/subscriptions/{id}', () => {
        const res = http.del(`${BASE_URL}/api/v1/alerts/subscriptions/999`, null, { headers });

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    // ===== Test Alert Endpoint =====
    group('POST /api/v1/alerts/test', () => {
        const payload = {
            channelType: 'webhook',
            channelConfig: { url: 'https://example.com/test' },
            message: 'Test alert from contract test',
        };
        const res = http.post(`${BASE_URL}/api/v1/alerts/test`, JSON.stringify(payload), {
            headers: jsonHeaders,
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has success field': (b) => typeof b.success === 'boolean',
                'has message': (b) => 'message' in b,
            });
        }
    });
}
