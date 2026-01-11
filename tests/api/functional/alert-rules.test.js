/**
 * Alert Rules Business Logic Tests
 * Owner: W1 (CP-9)
 *
 * Validates:
 * - Rule CRUD operations
 * - Enable/disable state transitions
 * - Rule validation constraints
 * - Alert triggering logic
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import { generateAlertRule } from '../fixtures/generators.js';

export const options = contractTestOptions;

const ALERT_URL = getBaseUrl('alert-service');
const BFF_URL = getBaseUrl('bff');
const headers = getBffHeaders();
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

let createdRuleId = null;

export default function () {
    // ===== Rule Creation =====
    group('Create Alert Rule', () => {
        const rule = generateAlertRule({
            name: `TestRule_${Date.now()}`,
            rule_type: 'risk_score',
            conditions: { threshold: 0.8 },
            severity: 'high',
        });

        const res = http.post(
            `${ALERT_URL}/api/v1/alert-rules`,
            JSON.stringify(rule),
            { headers: { 'Content-Type': 'application/json' } }
        );

        check(res, {
            'create returns 201': (r) => r.status === 201,
        });

        if (res.status === 201) {
            const body = res.json();
            createdRuleId = body.data?.id;

            check(body, {
                'response has data': (b) => 'data' in b,
                'data has id': (b) => b.data?.id != null,
                'name matches': (b) => b.data?.name === rule.name,
                'severity matches': (b) => b.data?.severity === rule.severity,
                'enabled by default': (b) => b.data?.enabled === true,
            });
        }
    });

    // ===== Rule State Transitions =====
    group('Disable Rule', () => {
        if (!createdRuleId) {
            check(null, { 'rule was created': () => false });
            return;
        }

        const res = http.post(
            `${ALERT_URL}/api/v1/alert-rules/${createdRuleId}/disable`,
            null,
            { headers: { 'Content-Type': 'application/json' } }
        );

        check(res, {
            'disable returns 200': (r) => r.status === 200,
        });

        // Verify state
        const getRes = http.get(`${ALERT_URL}/api/v1/alert-rules/${createdRuleId}`);
        if (getRes.status === 200) {
            check(getRes.json(), {
                'rule is now disabled': (b) => b.data?.enabled === false,
            });
        }
    });

    group('Enable Rule', () => {
        if (!createdRuleId) return;

        const res = http.post(
            `${ALERT_URL}/api/v1/alert-rules/${createdRuleId}/enable`,
            null,
            { headers: { 'Content-Type': 'application/json' } }
        );

        check(res, {
            'enable returns 200': (r) => r.status === 200,
        });

        // Verify state
        const getRes = http.get(`${ALERT_URL}/api/v1/alert-rules/${createdRuleId}`);
        if (getRes.status === 200) {
            check(getRes.json(), {
                'rule is now enabled': (b) => b.data?.enabled === true,
            });
        }
    });

    // ===== Rule Update =====
    group('Update Rule', () => {
        if (!createdRuleId) return;

        const update = {
            description: 'Updated description',
            severity: 'critical',
        };

        const res = http.put(
            `${ALERT_URL}/api/v1/alert-rules/${createdRuleId}`,
            JSON.stringify(update),
            { headers: { 'Content-Type': 'application/json' } }
        );

        check(res, {
            'update returns 200': (r) => r.status === 200,
        });

        // Verify update
        const getRes = http.get(`${ALERT_URL}/api/v1/alert-rules/${createdRuleId}`);
        if (getRes.status === 200) {
            check(getRes.json(), {
                'severity updated': (b) => b.data?.severity === 'critical',
            });
        }
    });

    // ===== Rule Validation =====
    group('Invalid Rule Rejected', () => {
        const invalidRules = [
            { name: '' }, // empty name
            { name: 'test', rule_type: 'invalid_type' }, // invalid type
            { name: 'test', rule_type: 'risk_score', severity: 'extreme' }, // invalid severity
        ];

        for (const rule of invalidRules) {
            const res = http.post(
                `${ALERT_URL}/api/v1/alert-rules`,
                JSON.stringify(rule),
                { headers: { 'Content-Type': 'application/json' } }
            );

            check(res, {
                'invalid rule rejected with 400': (r) => r.status === 400,
            });
        }
    });

    // ===== List Filtering =====
    group('List Rules with Filter', () => {
        const enabledRes = http.get(`${ALERT_URL}/api/v1/alert-rules?enabled=true`);
        const allRes = http.get(`${ALERT_URL}/api/v1/alert-rules`);

        check(enabledRes, {
            'enabled filter works': (r) => r.status === 200,
        });

        if (enabledRes.status === 200 && allRes.status === 200) {
            const enabledCount = enabledRes.json().data?.length || 0;
            const allCount = allRes.json().data?.length || 0;

            check(null, {
                'filtered count <= total': () => enabledCount <= allCount,
            });
        }
    });

    // ===== Cleanup =====
    group('Delete Rule', () => {
        if (!createdRuleId) return;

        const res = http.del(
            `${ALERT_URL}/api/v1/alert-rules/${createdRuleId}`,
            null,
            { headers: { 'Content-Type': 'application/json' } }
        );

        check(res, {
            'delete returns 200': (r) => r.status === 200,
        });

        // Verify deletion
        const getRes = http.get(`${ALERT_URL}/api/v1/alert-rules/${createdRuleId}`);
        check(getRes, {
            'rule no longer exists': (r) => r.status === 404,
        });

        createdRuleId = null;
    });
}
