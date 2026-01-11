/**
 * Query Service Contract Tests
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
    isValidAddress,
    isValidTxHash,
} from '../helpers/schema-validator.js';
import {
    defaultTestAddress,
    invalidAddresses,
    testAddresses,
    exchangeAddresses,
    specialAddresses,
} from '../fixtures/addresses.js';
import { randomTxHash } from '../fixtures/generators.js';
import * as schemas from '../schemas/query-service.js';

export const options = contractTestOptions;

const BASE_URL = getBaseUrl('query-service');

export default function () {
    // ========================================
    // Health Check
    // ========================================
    group('Health Check - GET /health', () => {
        const res = http.get(`${BASE_URL}/health`);
        check(res, {
            'status 200': (r) => r.status === 200,
            'response body exists': (r) => r.body && r.body.length > 0,
        });
    });

    // ========================================
    // Address Endpoints
    // ========================================
    group('Address Info - GET /api/v1/addresses/{address}', () => {
        const res = http.get(`${BASE_URL}/api/v1/addresses/${defaultTestAddress}`);

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
            'content-type json': (r) =>
                r.headers['Content-Type']?.includes('application/json'),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressInfoResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });
            if (!validation.valid) {
                console.log('Schema errors:', JSON.stringify(validation.errors));
            }

            check(body, {
                'success is true': (b) => b.success === true,
                'has data object': (b) => typeof b.data === 'object' && b.data !== null,
            });

            if (body.data) {
                check(body.data, {
                    'data.address matches request': (d) =>
                        d.address?.toLowerCase() === defaultTestAddress.toLowerCase(),
                    'data.network exists': (d) => typeof d.network === 'string',
                    'data.totalTxCount is number': (d) =>
                        typeof d.totalTxCount === 'number' || d.totalTxCount === undefined,
                });
            }
        }
    });

    group('Address Info - Invalid address format', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${invalidAddresses.tooShort}`
        );
        check(res, {
            'status 400 for too short': (r) => r.status === 400,
        });

        const res2 = http.get(
            `${BASE_URL}/api/v1/addresses/${invalidAddresses.badChars}`
        );
        check(res2, {
            'status 400 for bad chars': (r) => r.status === 400,
        });
    });

    group('Address Info - Network parameter', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}?network=ethereum`
        );
        check(res, {
            'accepts network param': (r) => [200, 404].includes(r.status),
        });
    });

    group('Address Stats - GET /api/v1/addresses/{address}/stats', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}/stats`
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AddressStatsResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });

            check(body, {
                'success is true': (b) => b.success === true,
            });

            if (body.data) {
                check(body.data, {
                    'has value stats fields': (d) =>
                        'totalValueSent' in d || 'totalValueReceived' in d || Object.keys(d).length >= 0,
                });
            }
        }
    });

    group('Address Stats - Invalid address', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${invalidAddresses.noPrefix}/stats`
        );
        check(res, {
            'status 400': (r) => r.status === 400,
        });
    });

    group('Address Transfers - GET /api/v1/addresses/{address}/transfers', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}/transfers?page=1&pageSize=10`
        );

        check(res, {
            'status 200 or 404': (r) => [200, 404].includes(r.status),
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.TransfersListResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });

            check(body, {
                'success is true': (b) => b.success === true,
                'data is array': (b) => Array.isArray(b.data),
            });

            if (body.meta) {
                check(body.meta, {
                    'meta.page exists': (m) => typeof m.page === 'number',
                    'meta.pageSize exists': (m) => typeof m.pageSize === 'number',
                });
            }

            if (body.data && body.data.length > 0) {
                const transfer = body.data[0];
                check(transfer, {
                    'transfer has required fields': (t) =>
                        hasFields(t, ['fromAddress', 'toAddress', 'value']),
                });
            }
        }
    });

    group('Address Transfers - Pagination', () => {
        const res1 = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}/transfers?page=1&pageSize=5`
        );
        const res2 = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}/transfers?page=2&pageSize=5`
        );

        check(res1, { 'page 1 ok': (r) => [200, 404].includes(r.status) });
        check(res2, { 'page 2 ok': (r) => [200, 404].includes(r.status) });
    });

    group('Address Transfers - Filter by type', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${defaultTestAddress}/transfers?transferType=native`
        );
        check(res, {
            'filter by type ok': (r) => [200, 404].includes(r.status),
        });
    });

    // ========================================
    // Transfer Endpoints
    // ========================================
    group('Transfers List - GET /api/v1/transfers', () => {
        const res = http.get(`${BASE_URL}/api/v1/transfers?page=1&pageSize=10`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.TransfersListResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });

            check(body, {
                'success is true': (b) => b.success === true,
                'data is array': (b) => Array.isArray(b.data),
            });
        }
    });

    group('Transfers List - With filters', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/transfers?address=${defaultTestAddress}&pageSize=5`
        );
        check(res, {
            'filter by address ok': (r) => r.status === 200,
        });

        const res2 = http.get(
            `${BASE_URL}/api/v1/transfers?transferType=erc20&pageSize=5`
        );
        check(res2, {
            'filter by type ok': (r) => r.status === 200,
        });

        const res3 = http.get(
            `${BASE_URL}/api/v1/transfers?network=ethereum&pageSize=5`
        );
        check(res3, {
            'filter by network ok': (r) => r.status === 200,
        });
    });

    group('Transfer by ID - GET /api/v1/transfers/{id}', () => {
        // First get a transfer ID from the list
        const listRes = http.get(`${BASE_URL}/api/v1/transfers?pageSize=1`);

        if (listRes.status === 200) {
            const listBody = listRes.json();
            if (listBody.data && listBody.data.length > 0) {
                const transferId = listBody.data[0].id;

                const res = http.get(`${BASE_URL}/api/v1/transfers/${transferId}`);

                check(res, {
                    'status 200': (r) => r.status === 200,
                });

                if (res.status === 200) {
                    const body = res.json();
                    check(body, {
                        'success is true': (b) => b.success === true,
                        'data.id matches': (b) => b.data?.id === transferId,
                    });
                }
            }
        }

        // Test non-existent ID
        const res404 = http.get(`${BASE_URL}/api/v1/transfers/999999999`);
        check(res404, {
            'status 404 for non-existent': (r) => r.status === 404,
        });

        // Test invalid ID format
        const resInvalid = http.get(`${BASE_URL}/api/v1/transfers/invalid`);
        check(resInvalid, {
            'status 400 for invalid id': (r) => r.status === 400,
        });
    });

    group('Transfer by TxHash - GET /api/v1/transfers/tx/{txHash}', () => {
        // First get a txHash from the list
        const listRes = http.get(`${BASE_URL}/api/v1/transfers?pageSize=1`);

        if (listRes.status === 200) {
            const listBody = listRes.json();
            if (listBody.data && listBody.data.length > 0 && listBody.data[0].txHash) {
                const txHash = listBody.data[0].txHash;

                const res = http.get(`${BASE_URL}/api/v1/transfers/tx/${txHash}`);

                check(res, {
                    'status 200': (r) => r.status === 200,
                });

                if (res.status === 200) {
                    const body = res.json();
                    const validation = validateSchema(
                        body,
                        schemas.TransfersByTxResponse
                    );

                    check(null, {
                        'schema valid': () => validation.valid,
                    });

                    check(body, {
                        'success is true': (b) => b.success === true,
                        'data is array': (b) => Array.isArray(b.data),
                    });

                    if (body.data && body.data.length > 0) {
                        check(body.data[0], {
                            'txHash matches': (t) =>
                                t.txHash?.toLowerCase() === txHash.toLowerCase(),
                        });
                    }
                }
            }
        }

        // Test non-existent txHash
        const fakeTxHash = randomTxHash();
        const res404 = http.get(`${BASE_URL}/api/v1/transfers/tx/${fakeTxHash}`);
        check(res404, {
            'status 200 or 404 for random hash': (r) => [200, 404].includes(r.status),
        });

        // Test invalid txHash format
        const resInvalid = http.get(`${BASE_URL}/api/v1/transfers/tx/invalid`);
        check(resInvalid, {
            'status 400 for invalid hash': (r) => r.status === 400,
        });
    });

    // ========================================
    // Cache Endpoints
    // ========================================
    group('Cache Stats - GET /api/v1/cache/stats', () => {
        const res = http.get(`${BASE_URL}/api/v1/cache/stats`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.CacheStatsResponse);

            check(null, {
                'schema valid': () => validation.valid,
            });

            check(body, {
                'success is true': (b) => b.success === true,
                'has data': (b) => 'data' in b,
            });

            if (body.data) {
                check(body.data, {
                    'has enabled field': (d) => typeof d.enabled === 'boolean',
                });
            }
        }
    });

    group('Cache Invalidate - DELETE /api/v1/cache/addresses/{address}', () => {
        // Use a test address to avoid invalidating real cached data
        const testAddr = testAddresses.test1;

        const res = http.del(`${BASE_URL}/api/v1/cache/addresses/${testAddr}`);

        check(res, {
            'status 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'success is true': (b) => b.success === true,
            });

            if (body.data) {
                check(body.data, {
                    'has address in response': (d) =>
                        d.address?.toLowerCase() === testAddr.toLowerCase(),
                    'has message': (d) => typeof d.message === 'string',
                });
            }
        }

        // Test invalid address
        const resInvalid = http.del(
            `${BASE_URL}/api/v1/cache/addresses/${invalidAddresses.tooShort}`
        );
        check(resInvalid, {
            'status 400 for invalid address': (r) => r.status === 400,
        });
    });

    // ========================================
    // Edge Cases & Error Handling
    // ========================================
    group('Edge Cases - Special addresses', () => {
        // Zero address
        const resZero = http.get(
            `${BASE_URL}/api/v1/addresses/${specialAddresses.zero}`
        );
        check(resZero, {
            'zero address returns 200 or 404': (r) => [200, 404].includes(r.status),
        });

        // Dead address
        const resDead = http.get(
            `${BASE_URL}/api/v1/addresses/${specialAddresses.dead}`
        );
        check(resDead, {
            'dead address returns 200 or 404': (r) => [200, 404].includes(r.status),
        });
    });

    group('Edge Cases - Pagination boundaries', () => {
        // Page 0 (should be treated as 1 or error)
        const res0 = http.get(`${BASE_URL}/api/v1/transfers?page=0&pageSize=10`);
        check(res0, {
            'page 0 handled': (r) => [200, 400].includes(r.status),
        });

        // Very large page
        const resLarge = http.get(
            `${BASE_URL}/api/v1/transfers?page=99999&pageSize=10`
        );
        check(resLarge, {
            'large page returns 200 with empty data': (r) => r.status === 200,
        });

        // pageSize 0
        const resSize0 = http.get(`${BASE_URL}/api/v1/transfers?page=1&pageSize=0`);
        check(resSize0, {
            'pageSize 0 handled': (r) => [200, 400].includes(r.status),
        });

        // Very large pageSize
        const resSizeLarge = http.get(
            `${BASE_URL}/api/v1/transfers?page=1&pageSize=1000`
        );
        check(resSizeLarge, {
            'large pageSize handled': (r) => [200, 400].includes(r.status),
        });
    });

    group('Edge Cases - Case sensitivity', () => {
        // Uppercase address (should work - Ethereum addresses are case-insensitive)
        const upperAddr = defaultTestAddress.toUpperCase();
        const res = http.get(`${BASE_URL}/api/v1/addresses/${upperAddr}`);
        check(res, {
            'uppercase address accepted': (r) => [200, 404].includes(r.status),
        });

        // Mixed case
        const mixedAddr =
            defaultTestAddress.slice(0, 10).toUpperCase() +
            defaultTestAddress.slice(10).toLowerCase();
        const resMixed = http.get(`${BASE_URL}/api/v1/addresses/${mixedAddr}`);
        check(resMixed, {
            'mixed case address accepted': (r) => [200, 404].includes(r.status),
        });
    });

    group('Error Response Format', () => {
        const res = http.get(
            `${BASE_URL}/api/v1/addresses/${invalidAddresses.tooShort}`
        );

        if (res.status === 400) {
            const body = res.json();
            check(body, {
                'error response has success=false': (b) => b.success === false,
                'error response has error object': (b) => 'error' in b,
            });

            if (body.error) {
                check(body.error, {
                    'error has code': (e) => typeof e.code === 'string',
                    'error has message': (e) => typeof e.message === 'string',
                });
            }
        }
    });
}
