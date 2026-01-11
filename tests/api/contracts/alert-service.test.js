/**
 * Alert Service Contract Tests
 * Validates API responses match OpenAPI spec
 * Owner: W3 (CP-6)
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { getBaseUrl } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import { validateSchema, hasFields, isValidSeverity, isISODate } from '../helpers/schema-validator.js';
import { generateAlertRule, generateSubscription, hoursAgoISO, nowISO } from '../fixtures/generators.js';
import * as schemas from '../schemas/alert-service.js';

export const options = contractTestOptions;

const BASE_URL = getBaseUrl('alert-service');

// Track created resources for cleanup
let createdRuleId = null;
let createdSubscriptionId = null;

// Helper to check if data is array or null (empty)
function isDataArrayOrNull(b) {
    return 'data' in b && (b.data === null || Array.isArray(b.data));
}

export default function () {
    // Health Check
    group('GET /health', () => {
        const res = http.get(`${BASE_URL}/health`);
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has status field': (b) => 'status' in b,
                'status is healthy': (b) => b.status === 'healthy',
            });
        }
    });

    // Alert Rules CRUD
    group('POST /api/v1/alert-rules - create rule', () => {
        const rule = generateAlertRule({
            name: `Contract Test Rule ${Date.now()}`,
            rule_type: 'risk_score',
            conditions: { threshold: 0.75, operator: 'gte' },
            severity: 'high',
        });
        
        const res = http.post(`${BASE_URL}/api/v1/alert-rules`, JSON.stringify(rule), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(res, {
            'status 201': (r) => r.status === 201,
        });
        
        if (res.status === 201) {
            const body = res.json();
            check(body, {
                'has data': (b) => 'data' in b,
                'data has id': (b) => b.data && typeof b.data.id === 'number',
                'data has name': (b) => b.data && b.data.name === rule.name,
                'data has rule_type': (b) => b.data && b.data.rule_type === rule.rule_type,
                'data has severity': (b) => b.data && isValidSeverity(b.data.severity),
                'data has enabled': (b) => b.data && typeof b.data.enabled === 'boolean',
                'data has created_at': (b) => b.data && isISODate(b.data.created_at),
            });
            
            // Store for later tests
            if (body.data && body.data.id) {
                createdRuleId = body.data.id;
            }
        }
    });

    group('POST /api/v1/alert-rules - invalid request', () => {
        const invalidRule = { name: 'test' }; // missing required fields
        const res = http.post(`${BASE_URL}/api/v1/alert-rules`, JSON.stringify(invalidRule), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(res, {
            'status 400 for invalid rule': (r) => r.status === 400,
            'has error message': (r) => {
                if (r.status !== 400) return true;
                const body = r.json();
                return body && ('error' in body || 'message' in body);
            },
        });
    });

    group('GET /api/v1/alert-rules', () => {
        const res = http.get(`${BASE_URL}/api/v1/alert-rules`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AlertRulesListResponse);
            
            check(body, {
                'has data array': (b) => 'data' in b && Array.isArray(b.data),
                'schema valid': () => validation.valid,
            });
            
            if (!validation.valid) {
                console.log('Schema errors:', validation.errors.join('; '));
            }
            
            // Validate first item structure if exists
            if (body.data && body.data.length > 0) {
                const item = body.data[0];
                check(item, {
                    'item has id': (i) => typeof i.id === 'number',
                    'item has name': (i) => typeof i.name === 'string',
                    'item has valid severity': (i) => isValidSeverity(i.severity),
                });
            }
        }
    });

    group('GET /api/v1/alert-rules?enabled=true', () => {
        const res = http.get(`${BASE_URL}/api/v1/alert-rules?enabled=true`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'all rules enabled': (b) => {
                    if (!b.data || !Array.isArray(b.data)) return false;
                    return b.data.every(r => r.enabled === true);
                },
            });
        }
    });

    group('GET /api/v1/alert-rules?severity=high', () => {
        const res = http.get(`${BASE_URL}/api/v1/alert-rules?severity=high`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            // Verify severity filter is applied correctly
            check(body, {
                'all rules have high severity': (b) => {
                    if (!b.data || b.data.length === 0) return true;
                    return b.data.every(r => r.severity === 'high');
                },
            });
        }
    });

    group('GET /api/v1/alert-rules/{id}', () => {
        if (!createdRuleId) {
            console.log('Skipping: no rule created');
            return;
        }
        
        const res = http.get(`${BASE_URL}/api/v1/alert-rules/${createdRuleId}`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has data': (b) => 'data' in b,
                'data id matches': (b) => b.data && b.data.id === createdRuleId,
                'data has conditions': (b) => b.data && typeof b.data.conditions === 'object',
            });
        }
    });

    group('PUT /api/v1/alert-rules/{id}', () => {
        if (!createdRuleId) {
            console.log('Skipping: no rule created');
            return;
        }
        
        const updatePayload = {
            name: `Updated Rule ${Date.now()}`,
            enabled: false,
        };
        
        const res = http.put(`${BASE_URL}/api/v1/alert-rules/${createdRuleId}`, JSON.stringify(updatePayload), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'data updated': (b) => b.data && b.data.enabled === false,
                'data has updated_at': (b) => b.data && isISODate(b.data.updated_at),
            });
        }
    });

    // Alert History
    group('GET /api/v1/alerts', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts?limit=10`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.AlertHistoryListResponse);
            
            check(body, {
                'has data field': (b) => isDataArrayOrNull(b),
                'schema valid': () => validation.valid,
                'respects limit': (b) => !b.data || b.data.length <= 10,
            });
            
            // Validate first item if exists
            if (body.data && body.data.length > 0) {
                const item = body.data[0];
                check(item, {
                    'alert has id': (i) => typeof i.id === 'number',
                    'alert has severity': (i) => isValidSeverity(i.severity),
                    'alert has status': (i) => ['pending', 'sent', 'failed', 'acknowledged'].includes(i.status),
                    'alert has created_at': (i) => isISODate(i.created_at),
                });
            }
        }
    });

    group('GET /api/v1/alerts - with time range filter', () => {
        const from = hoursAgoISO(24);
        const to = nowISO();
        const res = http.get(`${BASE_URL}/api/v1/alerts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=20`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has data': (b) => 'data' in b,
                'alerts within range': (b) => {
                    if (!b.data || b.data.length === 0) return true;
                    const fromTime = new Date(from).getTime();
                    const toTime = new Date(to).getTime();
                    return b.data.every(a => {
                        const t = new Date(a.created_at).getTime();
                        return t >= fromTime && t <= toTime;
                    });
                },
            });
        }
    });

    group('GET /api/v1/alerts?severity=critical', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts?severity=critical&limit=10`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'all alerts critical': (b) => {
                    if (!b.data || b.data.length === 0) return true;
                    return b.data.every(a => a.severity === 'critical');
                },
            });
        }
    });

    group('GET /api/v1/alerts?status=pending', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts?status=pending&limit=10`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'all alerts pending': (b) => {
                    if (!b.data || b.data.length === 0) return true;
                    return b.data.every(a => a.status === 'pending');
                },
            });
        }
    });

    // Alert Stats
    group('GET /api/v1/alerts/stats', () => {
        const res = http.get(`${BASE_URL}/api/v1/alerts/stats`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has data': (b) => 'data' in b,
                'has total': (b) => b.data && typeof b.data.total === 'number',
                'total non-negative': (b) => b.data && b.data.total >= 0,
                'has by_severity': (b) => b.data && typeof b.data.by_severity === 'object',
                'has by_status': (b) => b.data && typeof b.data.by_status === 'object',
            });
        }
    });

    group('GET /api/v1/alerts/stats - with time range', () => {
        const from = hoursAgoISO(168); // 7 days
        const to = nowISO();
        const res = http.get(`${BASE_URL}/api/v1/alerts/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'has period': (b) => b.period && b.period.from && b.period.to,
            });
        }
    });

    // Subscriptions
    group('POST /api/v1/subscriptions - create', () => {
        const subscription = generateSubscription(`test-user-${Date.now()}`, {
            channel_type: 'webhook',
            channel_config: {
                url: 'https://example.com/alerts',
                headers: { 'X-Custom': 'test' },
            },
            rule_id: createdRuleId,
        });
        
        const res = http.post(`${BASE_URL}/api/v1/subscriptions`, JSON.stringify(subscription), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(res, {
            'status 201': (r) => r.status === 201,
        });
        
        if (res.status === 201) {
            const body = res.json();
            check(body, {
                'has data': (b) => 'data' in b,
                'data has id': (b) => b.data && typeof b.data.id === 'number',
                'data has channel_type': (b) => b.data && b.data.channel_type === 'webhook',
                'data has enabled': (b) => b.data && typeof b.data.enabled === 'boolean',
            });
            
            if (body.data && body.data.id) {
                createdSubscriptionId = body.data.id;
            }
        }
    });

    group('POST /api/v1/subscriptions - invalid channel', () => {
        const invalid = {
            user_id: 'test',
            channel_type: 'invalid_channel',
        };
        
        const res = http.post(`${BASE_URL}/api/v1/subscriptions`, JSON.stringify(invalid), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(res, {
            'status 400 for invalid channel': (r) => r.status === 400,
        });
    });

    group('GET /api/v1/subscriptions', () => {
        const res = http.get(`${BASE_URL}/api/v1/subscriptions?user_id=test-user`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            const validation = validateSchema(body, schemas.SubscriptionsListResponse);
            
            check(body, {
                'has data field': (b) => isDataArrayOrNull(b),
                'schema valid': () => validation.valid,
            });
        }
    });

    group('GET /api/v1/subscriptions/{id}', () => {
        if (!createdSubscriptionId) {
            console.log('Skipping: no subscription created');
            return;
        }
        
        const res = http.get(`${BASE_URL}/api/v1/subscriptions/${createdSubscriptionId}`);
        
        check(res, {
            'status 200': (r) => r.status === 200,
        });
        
        if (res.status === 200) {
            const body = res.json();
            check(body, {
                'data id matches': (b) => b.data && b.data.id === createdSubscriptionId,
            });
        }
    });


    // Cleanup - Delete subscription
    group('DELETE /api/v1/subscriptions/{id}', () => {
        if (!createdSubscriptionId) {
            console.log('Skipping: no subscription to delete');
            return;
        }
        
        const res = http.del(`${BASE_URL}/api/v1/subscriptions/${createdSubscriptionId}`);
        
        check(res, {
            'status 200 or 204': (r) => [200, 204].includes(r.status),
        });
    });

    // Cleanup - Delete rule
    group('DELETE /api/v1/alert-rules/{id}', () => {
        if (!createdRuleId) {
            console.log('Skipping: no rule to delete');
            return;
        }
        
        const res = http.del(`${BASE_URL}/api/v1/alert-rules/${createdRuleId}`);
        
        check(res, {
            'status 200 or 204': (r) => [200, 204].includes(r.status),
        });
    });

    // Error cases
    group('GET /api/v1/alert-rules/{id} - not found', () => {
        const res = http.get(`${BASE_URL}/api/v1/alert-rules/999999999`);
        
        check(res, {
            'status 404 for non-existent': (r) => r.status === 404,
        });
    });

    group('GET /api/v1/subscriptions/{id} - not found', () => {
        const res = http.get(`${BASE_URL}/api/v1/subscriptions/999999999`);
        
        check(res, {
            'status 404 for non-existent': (r) => r.status === 404,
        });
    });
}
