/**
 * Risk Scoring Business Logic Tests
 * Owner: W1 (CP-9)
 *
 * Validates:
 * - Score determinism (same input = same output)
 * - Risk level boundaries match score ranges
 * - Factor aggregation logic
 * - Batch vs single consistency
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import { expectedRiskLevel } from '../fixtures/expected-responses.js';
import { defaultTestAddress, testAddresses } from '../fixtures/addresses.js';

export const options = contractTestOptions;

const RISK_URL = getBaseUrl('risk-ml-service');
const BFF_URL = getBaseUrl('bff');
const headers = getBffHeaders();
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

export default function () {
    // ===== Score Determinism =====
    group('Risk Score Determinism', () => {
        const address = defaultTestAddress;
        const payload = JSON.stringify({
            address: address,
            network: 'ethereum',
            include_factors: true,
        });

        const res1 = http.post(`${RISK_URL}/api/v1/risk/score`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        sleep(0.5);

        const res2 = http.post(`${RISK_URL}/api/v1/risk/score`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (res1.status === 200 && res2.status === 200) {
            const score1 = res1.json().risk_score;
            const score2 = res2.json().risk_score;

            check(null, {
                'score is deterministic': () => score1 === score2,
            });
        } else {
            check(null, {
                'both requests succeeded': () => false,
            });
        }
    });

    // ===== Risk Level Boundaries =====
    group('Risk Level Matches Score', () => {
        const address = defaultTestAddress;
        const payload = JSON.stringify({
            address: address,
            network: 'ethereum',
        });

        const res = http.post(`${RISK_URL}/api/v1/risk/score`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 200) {
            const { risk_score, risk_level } = res.json();
            const expected = expectedRiskLevel(risk_score);

            check(null, {
                'risk_level matches score range': () => risk_level === expected,
                'score in valid range [0,1]': () => risk_score >= 0 && risk_score <= 1,
            });
        }
    });

    // ===== Batch vs Single Consistency =====
    group('Batch vs Single Score Consistency', () => {
        const addresses = [testAddresses.test1, testAddresses.test2];

        // Get batch scores
        const batchRes = http.post(
            `${RISK_URL}/api/v1/risk/batch`,
            JSON.stringify({ addresses, network: 'ethereum', include_factors: false }),
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (batchRes.status !== 200) {
            check(null, { 'batch request succeeded': () => false });
            return;
        }

        const batchResults = batchRes.json().results;

        // Get individual scores
        let allMatch = true;
        for (let i = 0; i < addresses.length; i++) {
            const singleRes = http.post(
                `${RISK_URL}/api/v1/risk/score`,
                JSON.stringify({ address: addresses[i], network: 'ethereum' }),
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (singleRes.status === 200) {
                const singleScore = singleRes.json().risk_score;
                const batchScore = batchResults[i]?.risk_score;

                if (Math.abs(singleScore - batchScore) > 0.001) {
                    allMatch = false;
                }
            }
            sleep(0.1);
        }

        check(null, {
            'batch and single scores match': () => allMatch,
        });
    });

    // ===== Factor Contribution =====
    group('Risk Factors Present', () => {
        const payload = JSON.stringify({
            address: defaultTestAddress,
            network: 'ethereum',
            include_factors: true,
        });

        const res = http.post(`${RISK_URL}/api/v1/risk/score`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 200) {
            const body = res.json();

            check(body, {
                'has factors array': (b) => Array.isArray(b.factors),
                'factors have required fields': (b) =>
                    !b.factors?.length ||
                    b.factors.every((f) => 'name' in f && 'score' in f),
                'factor scores in range': (b) =>
                    !b.factors?.length ||
                    b.factors.every((f) => f.score >= 0 && f.score <= 1),
            });
        }
    });

    // ===== BFF Risk Score Aggregation =====
    group('BFF Risk Score Integration', () => {
        const payload = JSON.stringify({
            address: defaultTestAddress,
            network: 'ethereum',
            includeFactors: true,
        });

        const bffRes = http.post(`${BFF_URL}/api/v1/risk/score`, payload, {
            headers: jsonHeaders,
        });

        if (bffRes.status === 200) {
            const body = bffRes.json();

            check(body, {
                'BFF returns riskScore': (b) => 'riskScore' in b,
                'BFF returns riskLevel': (b) => 'riskLevel' in b,
                'BFF risk level valid': (b) =>
                    ['low', 'medium', 'high', 'critical'].includes(b.riskLevel),
            });
        }
    });
}
