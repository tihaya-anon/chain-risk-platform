/**
 * Cross-Service Pipeline Tests
 * Owner: W1 (CP-10)
 *
 * Validates end-to-end flows across multiple services:
 * - Full risk assessment pipeline
 * - Address investigation flow
 * - Alert trigger chain
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getBaseUrl, getBffHeaders } from '../config/environments.js';
import { contractTestOptions } from '../config/thresholds.js';
import { defaultTestAddress, testAddresses } from '../fixtures/addresses.js';

export const options = contractTestOptions;

const QUERY_URL = getBaseUrl('query-service');
const RISK_URL = getBaseUrl('risk-ml-service');
const GRAPH_URL = getBaseUrl('graph-service');
const ALERT_URL = getBaseUrl('alert-service');
const BFF_URL = getBaseUrl('bff');

const headers = getBffHeaders();
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

export default function () {
    const address = defaultTestAddress;

    // ===== Full Risk Assessment Pipeline =====
    group('Full Risk Assessment Pipeline', () => {
        // Step 1: Query address info
        const addrRes = http.get(`${QUERY_URL}/api/v1/addresses/${address}`);
        check(addrRes, {
            'step1: address query ok': (r) => r.status !== 500,
        });
        sleep(0.1);

        // Step 2: Get risk score
        const riskRes = http.post(
            `${RISK_URL}/api/v1/risk/score`,
            JSON.stringify({ address, network: 'ethereum' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
        check(riskRes, {
            'step2: risk score ok': (r) => r.status === 200,
        });
        sleep(0.1);

        // Step 3: Get graph neighbors
        const graphRes = http.get(
            `${GRAPH_URL}/api/v1/graph/address/${address}/neighbors?depth=1&limit=10`
        );
        check(graphRes, {
            'step3: graph query ok': (r) => r.status !== 500,
        });
        sleep(0.1);

        // Step 4: Check alert rules
        const alertRes = http.get(`${ALERT_URL}/api/v1/alert-rules`);
        check(alertRes, {
            'step4: alert rules ok': (r) => r.status === 200,
        });

        // Validate pipeline coherence
        if (riskRes.status === 200 && graphRes.status === 200) {
            const riskData = riskRes.json();
            const graphData = graphRes.json();

            check(null, {
                'pipeline: risk score exists': () => riskData.risk_score !== undefined,
                'pipeline: graph returns structure': () =>
                    Array.isArray(graphData.nodes) || graphData.address !== undefined,
            });
        }
    });

    // ===== BFF Aggregation Flow =====
    group('BFF Aggregated Address Investigation', () => {
        // Single BFF call should aggregate multiple backend services
        const bffAddrRes = http.get(`${BFF_URL}/api/v1/addresses/${address}`, {
            headers,
        });

        check(bffAddrRes, {
            'bff address: status ok': (r) => [200, 404].includes(r.status),
        });

        // Get risk via BFF (NestJS POST returns 201 by default)
        const bffRiskRes = http.post(
            `${BFF_URL}/api/v1/risk/score`,
            JSON.stringify({ address, network: 'ethereum' }),
            { headers: jsonHeaders }
        );

        check(bffRiskRes, {
            'bff risk: status ok': (r) => [200, 201].includes(r.status),
        });

        // Get graph neighbors via BFF
        const bffGraphRes = http.get(
            `${BFF_URL}/api/v1/graph/address/${address}/neighbors?depth=1`,
            { headers }
        );

        check(bffGraphRes, {
            'bff graph: status ok': (r) => [200, 404].includes(r.status),
        });

        // Verify BFF returns consistent data
        if ([200, 201].includes(bffRiskRes.status)) {
            const bffRisk = bffRiskRes.json();
            check(bffRisk, {
                'bff aggregates risk properly': (b) =>
                    b.address === address && b.riskScore !== undefined,
            });
        }
    });

    // ===== Graph Path Discovery =====
    group('Cross-Address Path Discovery', () => {
        const from = testAddresses.test1;
        const to = testAddresses.test2;

        // Direct graph service
        const directRes = http.get(
            `${GRAPH_URL}/api/v1/graph/path/${from}/${to}?maxDepth=3`
        );

        check(directRes, {
            'direct path query ok': (r) => r.status === 200,
        });

        // Via BFF
        const bffRes = http.get(
            `${BFF_URL}/api/v1/graph/path/${from}/${to}?maxDepth=3`,
            { headers }
        );

        check(bffRes, {
            'bff path query ok': (r) => r.status === 200,
        });

        // Results should be consistent
        if (directRes.status === 200 && bffRes.status === 200) {
            const directData = directRes.json();
            const bffData = bffRes.json();

            check(null, {
                'path results consistent': () =>
                    directData.found === bffData.found,
            });
        }
    });

    // ===== Service Health Chain =====
    group('All Services Health Check', () => {
        const services = [
            { name: 'query', url: `${QUERY_URL}/health` },
            { name: 'risk', url: `${RISK_URL}/health` },
            { name: 'graph', url: `${GRAPH_URL}/api/health` },
            { name: 'alert', url: `${ALERT_URL}/health` },
        ];

        let healthyCount = 0;
        for (const svc of services) {
            const res = http.get(svc.url);
            if (res.status === 200) healthyCount++;
        }

        check(null, {
            'all backend services healthy': () => healthyCount === services.length,
        });
    });

    // ===== Data Consistency: Graph ↔ Query =====
    group('Graph and Query Data Consistency', () => {
        // Query service address info
        const queryRes = http.get(`${QUERY_URL}/api/v1/addresses/${address}`);

        // Graph service address info
        const graphRes = http.get(`${GRAPH_URL}/api/v1/graph/address/${address}`);

        if (queryRes.status === 200 && graphRes.status === 200) {
            const queryData = queryRes.json().data;
            const graphData = graphRes.json();

            check(null, {
                'address matches across services': () =>
                    queryData?.address?.toLowerCase() ===
                    graphData?.address?.toLowerCase(),
            });
        } else {
            // Both should either have data or both return 404
            check(null, {
                'consistent data presence': () =>
                    (queryRes.status === 404 && graphRes.status === 404) ||
                    (queryRes.status === 200 && graphRes.status === 200),
            });
        }
    });
}
