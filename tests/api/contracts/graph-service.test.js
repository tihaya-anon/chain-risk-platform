/**
 * Graph Service Contract Tests
 * Validates API responses match OpenAPI spec
 * Owner: W4
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { getBaseUrl } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import {
    validateSchema,
    hasFields,
    isInRange,
    isValidAddress,
} from '../helpers/schema-validator.js';
import { defaultTestAddress, testAddresses, invalidAddresses } from '../fixtures/addresses.js';
import * as schemas from '../schemas/graph-service.js';

export const options = contractTestOptions;

const BASE_URL = getBaseUrl('graph-service');

export default function () {
    // ===== Health Endpoints =====
    group('Health Check', () => {
        const res = http.get(`${BASE_URL}/api/health`);
        check(res, {
            'status 200': (r) => r.status === 200,
            'returns object': (r) => typeof r.json() === 'object',
        });
    });

    group('Health Ready', () => {
        const res = http.get(`${BASE_URL}/api/health/ready`);
        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    group('Health Live', () => {
        const res = http.get(`${BASE_URL}/api/health/live`);
        check(res, {
            'status 200': (r) => r.status === 200,
        });
    });

    // ===== Address Info Endpoints =====
    group('GET /api/v1/graph/address/{address} - valid address', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}`);

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressInfoResponse);
            check(null, {
                'response matches AddressInfoResponse schema': () => validation.valid,
            });
            if (!validation.valid) {
                console.log('Schema errors:', JSON.stringify(validation.errors));
            }
            check(body, {
                'address field matches request': (b) =>
                    b.address?.toLowerCase() === defaultTestAddress.toLowerCase(),
            });
        }
    });

    group('GET /api/v1/graph/address/{address} - invalid address format', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${invalidAddresses.tooShort}`);
        check(res, {
            'status 400 or 404 for invalid': (r) => [400, 404].includes(r.status),
        });
    });

    // ===== Neighbors Endpoint =====
    group('GET /api/v1/graph/address/{address}/neighbors - default params', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/neighbors`);

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressNeighborsResponse);
            check(null, {
                'response matches AddressNeighborsResponse schema': () => validation.valid,
            });
            if (!validation.valid) {
                console.log('Neighbors schema errors:', JSON.stringify(validation.errors));
            }
            check(body, {
                'has address field': (b) => 'address' in b,
                'has nodes array': (b) => Array.isArray(b.nodes),
                'has edges array': (b) => Array.isArray(b.edges),
            });
        }
    });

    group('GET /api/v1/graph/address/{address}/neighbors - with params', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/neighbors?depth=2&limit=20`
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'depth <= 3': (b) => !b.depth || b.depth <= 3,
                'nodes count <= limit': (b) => !b.nodes || b.nodes.length <= 20,
            });
        }
    });

    group('GET /api/v1/graph/address/{address}/neighbors - depth out of range', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/neighbors?depth=10`
        );
        // Validation errors should return 400
        check(res, {
            'returns error for invalid depth': (r) => r.status === 400,
        });
    });

    // ===== Tags Endpoints =====
    group('GET /api/v1/graph/address/{address}/tags', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags`);

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
                'all items are strings': () => body.every((t) => typeof t === 'string'),
            });
        }
    });

    group('POST /api/v1/graph/address/{address}/tags - add tags', () => {
        const payload = JSON.stringify({
            tags: ['test-tag-contract'],
            source: 'contract-test',
            confidence: 0.9,
        });

        const res = http.post(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags`,
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        // Should return 200 or 201 for valid request
        check(res, {
            'add tags response': (r) => [200, 201].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressInfoResponse);
            check(null, {
                'response matches AddressInfoResponse schema': () => validation.valid,
            });
        }
    });

    group('POST /api/v1/graph/address/{address}/tags - missing required field', () => {
        const payload = JSON.stringify({
            source: 'contract-test',
        });

        const res = http.post(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags`,
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        // Validation errors should return 400
        check(res, {
            'returns error for missing tags': (r) => r.status === 400,
        });
    });

    group('DELETE /api/v1/graph/address/{address}/tags/{tag}', () => {
        const res = http.del(
            `${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/tags/test-tag-contract`
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    // ===== Cluster Endpoints =====
    group('GET /api/v1/graph/address/{address}/cluster', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/address/${defaultTestAddress}/cluster`);

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.ClusterResponse);
            check(null, {
                'response matches ClusterResponse schema': () => validation.valid,
            });
            check(body, {
                'has clusterId': (b) => 'clusterId' in b,
            });
        }
    });

    group('GET /api/v1/graph/cluster/{clusterId} - non-existent', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/cluster/non-existent-cluster-id`);

        check(res, {
            'status 404 for non-existent cluster': (r) => r.status === 404,
        });
    });

    // ===== Path Endpoint =====
    group('GET /api/v1/graph/path/{from}/{to} - valid addresses', () => {
        const from = testAddresses.test1;
        const to = testAddresses.test2;
        const res = http.get(`${BASE_URL}/api/v1/graph/path/${from}/${to}?maxDepth=3`);

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
                'has found field': (b) => typeof b.found === 'boolean',
                'has fromAddress': (b) => 'fromAddress' in b,
                'has toAddress': (b) => 'toAddress' in b,
                'fromAddress matches request': (b) =>
                    b.fromAddress?.toLowerCase() === from.toLowerCase(),
                'toAddress matches request': (b) =>
                    b.toAddress?.toLowerCase() === to.toLowerCase(),
            });
        }
    });

    group('GET /api/v1/graph/path/{from}/{to} - same address', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/graph/path/${defaultTestAddress}/${defaultTestAddress}`
        );

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'found is true for same address': (b) => b.found === true,
                'path length is 0 or 1': (b) => b.pathLength <= 1,
            });
        }
    });

    // ===== Search Endpoints =====
    group('GET /api/v1/graph/search/high-risk - default params', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/search/high-risk`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
            });
            if (body.length > 0) {
                check(body[0], {
                    'items have address field': (item) => 'address' in item,
                    'items have riskScore >= 0.6': (item) =>
                        item.riskScore === undefined || item.riskScore === null || item.riskScore >= 0.6,
                });
            }
        }
    });

    group('GET /api/v1/graph/search/high-risk - custom threshold', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/search/high-risk?threshold=0.8&limit=5`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'results <= limit': () => body.length <= 5,
            });
        }
    });

    group('GET /api/v1/graph/search/high-risk - invalid threshold', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/search/high-risk?threshold=1.5`);

        // Validation errors should return 400
        check(res, {
            'returns error for invalid threshold': (r) => r.status === 400,
        });
    });

    group('GET /api/v1/graph/search/tag/{tag}', () => {
        const res = http.get(`${BASE_URL}/api/v1/graph/search/tag/exchange?limit=10`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(null, {
                'response is array': () => Array.isArray(body),
                'results <= limit': () => body.length <= 10,
            });
        }
    });

    // ===== Propagation Endpoints =====
    group('POST /api/v1/graph/propagate - global propagation', () => {
        const res = http.post(`${BASE_URL}/api/v1/graph/propagate`, null, {
            headers: { 'Content-Type': 'application/json' },
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
            check(body, {
                'has status field': (b) => 'status' in b,
            });
        }
    });

    group('POST /api/v1/graph/propagate/{address}', () => {
        const res = http.post(`${BASE_URL}/api/v1/graph/propagate/${defaultTestAddress}`, null, {
            headers: { 'Content-Type': 'application/json' },
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has status field': (b) => 'status' in b,
            });
        }
    });

    // ===== Clustering Endpoints =====
    group('POST /api/v1/graph/cluster/run', () => {
        const res = http.post(`${BASE_URL}/api/v1/graph/cluster/run`, null, {
            headers: { 'Content-Type': 'application/json' },
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
            check(body, {
                'has status field': (b) => 'status' in b,
            });
        }
    });

    group('POST /api/v1/graph/cluster/manual - valid request', () => {
        const payload = JSON.stringify([testAddresses.test1, testAddresses.test2]);

        const res = http.post(`${BASE_URL}/api/v1/graph/cluster/manual`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has status field': (b) => 'status' in b,
            });
        }
    });

    group('POST /api/v1/graph/cluster/manual - empty array', () => {
        const payload = JSON.stringify([]);

        const res = http.post(`${BASE_URL}/api/v1/graph/cluster/manual`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        // Returns 200 with status:failed for validation errors
        check(res, {
            'returns response for empty array': (r) => [200, 400].includes(r.status),
        });
    });

    // ===== Admin Endpoints =====
    group('GET /admin/status', () => {
        const res = http.get(`${BASE_URL}/admin/status`);

        check(res, {
            'status 200': (r) => r.status === 200,
            'returns object': (r) => typeof r.json() === 'object',
        });
    });

    group('GET /admin/config', () => {
        const res = http.get(`${BASE_URL}/admin/config`);
        // Note: /admin/config returns very large JSON due to Spring proxy objects
        // Only check status, skip JSON parsing to avoid k6 parser issues
        check(res, {
            'status 200': (r) => r.status === 200,
            'has response body': (r) => r.body && r.body.length > 0,
        });
    });
}
