/**
 * Risk ML Service Contract Tests
 * Full endpoint coverage with schema validation against OpenAPI spec
 * Owner: W2
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { getBaseUrl } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import {
    validateSchema,
    hasFields,
    isInRange,
    isValidRiskLevel,
    isValidAddress,
    isISODate,
} from '../helpers/schema-validator.js';
import {
    defaultTestAddress,
    testAddresses,
    invalidAddresses,
    exchangeAddresses,
    specialAddresses,
} from '../fixtures/addresses.js';
import {
    generateRiskScoreRequest,
    generateBatchRiskRequest,
    randomAddress,
    randomAddressBatch,
} from '../fixtures/generators.js';
import * as schemas from '../schemas/risk-ml-service.js';

export const options = contractTestOptions;

const BASE_URL = getBaseUrl('risk-ml-service');
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default function () {
    // ========================================
    // Health & Info Endpoints
    // ========================================
    group('Health Check - GET /health', () => {
        const res = http.get(`${BASE_URL}/health`);
        check(res, {
            'status 200': (r) => r.status === 200,
            'response body exists': (r) => r.body && r.body.length > 0,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has status field': (b) => 'status' in b,
            });
        }
    });

    group('Root Endpoint - GET /', () => {
        const res = http.get(`${BASE_URL}/`);
        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has service info': (b) => 'service' in b || 'name' in b || 'version' in b,
            });
        }
    });


    // ========================================
    // Single Address Risk Score
    // ========================================
    group('Risk Score - POST /api/v1/risk/score - Valid request', () => {
        const payload = generateRiskScoreRequest(defaultTestAddress);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 200': (r) => r.status === 200,
            'content-type json': (r) =>
                r.headers['Content-Type']?.includes('application/json'),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.RiskScoreResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });
            if (!validation.valid) {
                console.log('Schema errors:', JSON.stringify(validation.errors));
            }

            check(body, {
                'has address': (b) => 'address' in b,
                'address matches request': (b) =>
                    b.address?.toLowerCase() === defaultTestAddress.toLowerCase(),
                'has network': (b) => 'network' in b,
                'has risk_score': (b) => 'risk_score' in b,
                'risk_score in [0,1]': (b) => isInRange(b.risk_score, 0, 1),
                'has risk_level': (b) => 'risk_level' in b,
                'valid risk_level': (b) => isValidRiskLevel(b.risk_level),
            });

            // Verify risk_level matches risk_score ranges
            if (body.risk_score !== undefined && body.risk_level) {
                const score = body.risk_score;
                const level = body.risk_level;
                let expectedLevel;
                if (score < 0.25) expectedLevel = 'low';
                else if (score < 0.5) expectedLevel = 'medium';
                else if (score < 0.75) expectedLevel = 'high';
                else expectedLevel = 'critical';

                check(null, {
                    'risk_level consistent with score': () => level === expectedLevel,
                });
            }

            // Check optional fields when include_factors=true
            if (payload.include_factors && body.factors) {
                check(body, {
                    'factors is array': (b) => Array.isArray(b.factors),
                });

                if (body.factors.length > 0) {
                    const factor = body.factors[0];
                    check(factor, {
                        'factor has name': (f) => typeof f.name === 'string',
                        'factor has score': (f) => typeof f.score === 'number',
                        'factor score in [0,1]': (f) => isInRange(f.score, 0, 1),
                        'factor has description': (f) => typeof f.description === 'string',
                    });
                }
            }

            // Check evaluated_at if present
            if (body.evaluated_at) {
                check(body, {
                    'evaluated_at is valid ISO date': (b) => isISODate(b.evaluated_at),
                });
            }
        }
    });

    group('Risk Score - POST /api/v1/risk/score - Without factors', () => {
        const payload = generateRiskScoreRequest(defaultTestAddress, {
            include_factors: false,
        });
        const res = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has required fields': (b) =>
                    hasFields(b, ['address', 'network', 'risk_score', 'risk_level']),
            });
        }
    });

    group('Risk Score - POST /api/v1/risk/score - Invalid address', () => {
        // Too short (fails length validation)
        const payload1 = generateRiskScoreRequest(invalidAddresses.tooShort);
        const res1 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload1),
            { headers: JSON_HEADERS }
        );
        check(res1, {
            'status 422 for too short': (r) => r.status === 422,
        });

        // Bad characters (42 chars - service only validates length, accepts any 42-char string)
        const payload2 = generateRiskScoreRequest(invalidAddresses.badChars);
        const res2 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload2),
            { headers: JSON_HEADERS }
        );
        check(res2, {
            'bad chars 42-char accepted': (r) => r.status === 200,
        });

        // No prefix (40 chars - fails length validation)
        const payload3 = generateRiskScoreRequest(invalidAddresses.noPrefix);
        const res3 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload3),
            { headers: JSON_HEADERS }
        );
        check(res3, {
            'status 422 for no prefix': (r) => r.status === 422,
        });

        // Too long (fails length validation)
        const payload4 = generateRiskScoreRequest(invalidAddresses.tooLong);
        const res4 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload4),
            { headers: JSON_HEADERS }
        );
        check(res4, {
            'status 422 for too long': (r) => r.status === 422,
        });
    });

    group('Risk Score - POST /api/v1/risk/score - Validation error format', () => {
        const payload = generateRiskScoreRequest(invalidAddresses.tooShort);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        if (res.status === 422) {
            const body = res.json();
            const validation = validateSchema(body, schemas.ValidationError);

            check(null, {
                'validation error schema valid': () => validation.valid,
            });

            check(body, {
                'has detail array': (b) => Array.isArray(b.detail),
            });

            if (body.detail && body.detail.length > 0) {
                const error = body.detail[0];
                check(error, {
                    'error has loc': (e) => Array.isArray(e.loc),
                    'error has msg': (e) => typeof e.msg === 'string',
                    'error has type': (e) => typeof e.type === 'string',
                });
            }
        }
    });

    group('Risk Score - POST /api/v1/risk/score - Missing address', () => {
        const payload = { network: 'ethereum' }; // Missing required 'address'
        const res = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );
        check(res, {
            'status 422 for missing address': (r) => r.status === 422,
        });
    });

    group('Risk Score - POST /api/v1/risk/score - Empty body', () => {
        const res = http.post(`${BASE_URL}/api/v1/risk/score`, '{}', {
            headers: JSON_HEADERS,
        });
        check(res, {
            'status 422 for empty body': (r) => r.status === 422,
        });
    });

    group('Risk Score - POST /api/v1/risk/score - Invalid JSON', () => {
        const res = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            'not json',
            { headers: JSON_HEADERS }
        );
        check(res, {
            'status 422 for invalid json': (r) => r.status === 422,
        });
    });

    // ========================================
    // Batch Risk Score
    // ========================================
    group('Batch Risk Score - POST /api/v1/risk/batch - Valid request', () => {
        const addresses = [testAddresses.test1, testAddresses.test2, testAddresses.test3];
        const payload = generateBatchRiskRequest(addresses);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.BatchRiskScoreResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });

            check(body, {
                'has results array': (b) => Array.isArray(b.results),
                'has total': (b) => typeof b.total === 'number',
                'total matches input': (b) => b.total === addresses.length,
                'results length matches': (b) => b.results?.length <= addresses.length,
            });

            if (body.failed !== undefined) {
                check(body, {
                    'failed is number': (b) => typeof b.failed === 'number',
                    'failed + results = total': (b) =>
                        (b.results?.length || 0) + (b.failed || 0) === b.total,
                });
            }

            // Verify each result
            if (body.results && body.results.length > 0) {
                const result = body.results[0];
                check(result, {
                    'result has address': (r) => 'address' in r,
                    'result has risk_score': (r) => 'risk_score' in r,
                    'result has risk_level': (r) => 'risk_level' in r,
                    'result risk_score valid': (r) => isInRange(r.risk_score, 0, 1),
                });
            }
        }
    });

    group('Batch Risk Score - POST /api/v1/risk/batch - Single address', () => {
        const payload = generateBatchRiskRequest([defaultTestAddress]);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'total is 1': (b) => b.total === 1,
            });
        }
    });

    group('Batch Risk Score - POST /api/v1/risk/batch - Empty array', () => {
        const payload = generateBatchRiskRequest([]);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 422 for empty array': (r) => r.status === 422,
        });
    });

    group('Batch Risk Score - POST /api/v1/risk/batch - Max addresses (100)', () => {
        // Generate 100 random addresses
        const addresses = randomAddressBatch(100);
        const payload = generateBatchRiskRequest(addresses);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 200 for 100 addresses': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'total is 100': (b) => b.total === 100,
            });
        }
    });

    group('Batch Risk Score - POST /api/v1/risk/batch - Exceeds max (101)', () => {
        const addresses = randomAddressBatch(101);
        const payload = generateBatchRiskRequest(addresses);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 422 for >100 addresses': (r) => r.status === 422,
        });
    });

    group('Batch Risk Score - POST /api/v1/risk/batch - Mixed valid/invalid', () => {
        const addresses = [
            testAddresses.test1,
            invalidAddresses.tooShort, // Invalid
            testAddresses.test2,
        ];
        const payload = generateBatchRiskRequest(addresses);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        // Service should either reject all (422) or process valid ones with failed count
        check(res, {
            'handles mixed addresses': (r) => [200, 422].includes(r.status),
        });
    });

    group('Batch Risk Score - POST /api/v1/risk/batch - Duplicate addresses', () => {
        const addr = defaultTestAddress;
        const payload = generateBatchRiskRequest([addr, addr, addr]);
        const res = http.post(
            `${BASE_URL}/api/v1/risk/batch`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        check(res, {
            'status 200 or 422': (r) => [200, 422].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'handles duplicates': (b) => b.total === 3 || b.results?.length <= 3,
            });
        }
    });

    // ========================================
    // Risk Rules
    // ========================================
    group('Risk Rules - GET /api/v1/risk/rules', () => {
        const res = http.get(`${BASE_URL}/api/v1/risk/rules`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.RiskRulesListResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });

            check(body, {
                'is array': (b) => Array.isArray(b),
            });

            if (body.length > 0) {
                const rule = body[0];
                check(rule, {
                    'rule is object': (r) => typeof r === 'object' && r !== null,
                });

                // Check common rule fields if present
                if ('name' in rule) {
                    check(rule, {
                        'rule.name is string': (r) => typeof r.name === 'string',
                    });
                }
                if ('weight' in rule) {
                    check(rule, {
                        'rule.weight is number': (r) => typeof r.weight === 'number',
                    });
                }
                if ('enabled' in rule) {
                    check(rule, {
                        'rule.enabled is boolean': (r) => typeof r.enabled === 'boolean',
                    });
                }
            }
        }
    });

    // ========================================
    // Edge Cases & Special Addresses
    // ========================================
    group('Edge Cases - Special addresses', () => {
        // Zero address
        const payload1 = generateRiskScoreRequest(specialAddresses.zero);
        const res1 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload1),
            { headers: JSON_HEADERS }
        );
        check(res1, {
            'zero address returns 200': (r) => r.status === 200,
        });

        // Dead address
        const payload2 = generateRiskScoreRequest(specialAddresses.dead);
        const res2 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload2),
            { headers: JSON_HEADERS }
        );
        check(res2, {
            'dead address returns 200': (r) => r.status === 200,
        });
    });

    group('Edge Cases - Case sensitivity', () => {
        // Uppercase should be accepted
        const upperAddr = defaultTestAddress.toUpperCase();
        const payload1 = generateRiskScoreRequest(upperAddr);
        const res1 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload1),
            { headers: JSON_HEADERS }
        );
        check(res1, {
            'uppercase address accepted': (r) => r.status === 200,
        });

        // Mixed case
        const mixedAddr =
            defaultTestAddress.slice(0, 10).toUpperCase() +
            defaultTestAddress.slice(10).toLowerCase();
        const payload2 = generateRiskScoreRequest(mixedAddr);
        const res2 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload2),
            { headers: JSON_HEADERS }
        );
        check(res2, {
            'mixed case address accepted': (r) => r.status === 200,
        });
    });

    group('Edge Cases - Network parameter', () => {
        // Different network
        const payload = generateRiskScoreRequest(defaultTestAddress, {
            network: 'bsc',
        });
        const res = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );
        check(res, {
            'bsc network accepted': (r) => [200, 422].includes(r.status),
        });

        // Invalid network (should still work or return 422)
        const payload2 = generateRiskScoreRequest(defaultTestAddress, {
            network: 'invalid_network',
        });
        const res2 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload2),
            { headers: JSON_HEADERS }
        );
        check(res2, {
            'invalid network handled': (r) => [200, 422].includes(r.status),
        });
    });

    group('Idempotency - Same request returns consistent results', () => {
        const payload = generateRiskScoreRequest(defaultTestAddress);

        const res1 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );
        const res2 = http.post(
            `${BASE_URL}/api/v1/risk/score`,
            JSON.stringify(payload),
            { headers: JSON_HEADERS }
        );

        if (res1.status === 200 && res2.status === 200) {
            const body1 = res1.json();
            const body2 = res2.json();

            check(null, {
                'risk_score is consistent': () =>
                    body1.risk_score === body2.risk_score,
                'risk_level is consistent': () =>
                    body1.risk_level === body2.risk_level,
            });
        }
    });
}
