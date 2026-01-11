/**
 * SLA Definitions and Performance Thresholds
 * Owner: W3 (CP-13)
 * 
 * Defines service-level agreements for:
 * - Latency targets (p95, p99)
 * - Error rate limits
 * - Throughput requirements
 * - Degradation policies
 */

/**
 * Service SLA Definitions
 * 
 * | Service          | p95 (ms) | p99 (ms) | Error Rate | Target RPS |
 * |------------------|----------|----------|------------|------------|
 * | query-service    | 200      | 500      | 1%         | 100        |
 * | risk-ml-service  | 500      | 1000     | 1%         | 50         |
 * | alert-service    | 200      | 500      | 1%         | 80         |
 * | graph-service    | 300      | 800      | 1%         | 80         |
 * | bff              | 800      | 1500     | 1%         | 50         |
 */
export const slaDefinitions = {
    'query-service': {
        p95: 200,
        p99: 500,
        errorRate: 0.01,
        rps: 100,
        description: 'Address and transaction queries',
    },
    'risk-ml-service': {
        p95: 500,
        p99: 1000,
        errorRate: 0.01,
        rps: 50,
        description: 'ML-based risk scoring (includes model inference)',
    },
    'alert-service': {
        p95: 200,
        p99: 500,
        errorRate: 0.01,
        rps: 80,
        description: 'Alert rules and notification management',
    },
    'graph-service': {
        p95: 300,
        p99: 800,
        errorRate: 0.01,
        rps: 80,
        description: 'Neo4j graph traversal operations',
    },
    'bff': {
        p95: 800,
        p99: 1500,
        errorRate: 0.01,
        rps: 50,
        description: 'Aggregated BFF endpoint (calls multiple services)',
    },
};

/**
 * Degradation Policies
 * 
 * Defines acceptable performance degradation under load:
 * - BASELINE: Normal operation targets
 * - STRESS: 2x latency allowed, 5% error rate
 * - SPIKE: 3x latency allowed, 10% error rate
 * - CRITICAL: Service is considered unhealthy
 */
export const degradationPolicies = {
    baseline: {
        latencyMultiplier: 1.0,
        errorRateLimit: 0.01,
        description: 'Normal operation, all SLAs must be met',
    },
    stress: {
        latencyMultiplier: 2.0,
        errorRateLimit: 0.05,
        description: 'Under heavy load (100-200 VUs)',
    },
    spike: {
        latencyMultiplier: 3.0,
        errorRateLimit: 0.10,
        description: 'Traffic spike (500+ VUs)',
    },
    critical: {
        latencyMultiplier: 5.0,
        errorRateLimit: 0.20,
        description: 'System degraded, requires intervention',
    },
};

/**
 * Build k6 thresholds from SLA definitions
 */
export function buildThresholds(services = Object.keys(slaDefinitions), policy = 'baseline') {
    const thresholds = {
        checks: ['rate>0.95'],
        http_req_failed: [`rate<${degradationPolicies[policy].errorRateLimit}`],
    };
    
    const multiplier = degradationPolicies[policy].latencyMultiplier;
    
    services.forEach(svc => {
        const sla = slaDefinitions[svc];
        if (!sla) return;
        
        const prefix = svc.replace(/-/g, '_');
        thresholds[`${prefix}_duration`] = [
            `p(95)<${Math.round(sla.p95 * multiplier)}`,
            `p(99)<${Math.round(sla.p99 * multiplier)}`,
        ];
        thresholds[`${prefix}_errors`] = [`rate<${degradationPolicies[policy].errorRateLimit}`];
    });
    
    return thresholds;
}

/**
 * Contract Test Options
 * Single iteration, all checks must pass
 */
export const contractTestOptions = {
    scenarios: {
        contract: {
            executor: 'shared-iterations',
            vus: 1,
            iterations: 1,
        },
    },
    thresholds: {
        checks: ['rate==1.0'],
    },
};

/**
 * Baseline Test Options
 * Establishes SLA baselines under normal load
 */
export const baselineTestOptions = {
    scenarios: {
        warmup: {
            executor: 'constant-vus',
            vus: 5,
            duration: '30s',
            startTime: '0s',
        },
        baseline: {
            executor: 'constant-rate',
            rate: 50,
            timeUnit: '1s',
            duration: '5m',
            preAllocatedVUs: 20,
            startTime: '30s',
        },
    },
    thresholds: buildThresholds(Object.keys(slaDefinitions), 'baseline'),
};

/**
 * Stress Test Options
 * Ramps to 200 VUs with relaxed thresholds
 */
export const stressTestOptions = {
    scenarios: {
        stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 50 },
                { duration: '2m', target: 100 },
                { duration: '2m', target: 150 },
                { duration: '2m', target: 200 },
                { duration: '1m', target: 0 },
            ],
        },
    },
    thresholds: buildThresholds(Object.keys(slaDefinitions), 'stress'),
};

/**
 * Spike Test Options
 * Sudden spike to 500 VUs with most relaxed thresholds
 */
export const spikeTestOptions = {
    scenarios: {
        spike: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 },
                { duration: '10s', target: 500 },
                { duration: '1m', target: 500 },
                { duration: '10s', target: 50 },
                { duration: '30s', target: 50 },
                { duration: '10s', target: 0 },
            ],
        },
    },
    thresholds: {
        checks: ['rate>0.85'],
        http_req_failed: ['rate<0.10'],
    },
};

/**
 * Get SLA status message
 */
export function getSLAStatus(metric, service, policy = 'baseline') {
    const sla = slaDefinitions[service];
    if (!sla) return 'UNKNOWN';
    
    const multiplier = degradationPolicies[policy].latencyMultiplier;
    const p95Limit = sla.p95 * multiplier;
    const p99Limit = sla.p99 * multiplier;
    
    if (metric.p95 <= sla.p95 && metric.p99 <= sla.p99) {
        return 'HEALTHY';
    } else if (metric.p95 <= p95Limit && metric.p99 <= p99Limit) {
        return 'DEGRADED';
    } else {
        return 'CRITICAL';
    }
}

/**
 * Format SLA table for reports
 */
export function formatSLATable() {
    let table = 'Service          | p95 (ms) | p99 (ms) | Error % | RPS\n';
    table += '─────────────────┼──────────┼──────────┼─────────┼─────\n';
    
    for (const [name, sla] of Object.entries(slaDefinitions)) {
        const n = name.padEnd(16);
        const p95 = sla.p95.toString().padStart(8);
        const p99 = sla.p99.toString().padStart(8);
        const err = (sla.errorRate * 100).toFixed(0).padStart(7);
        const rps = sla.rps.toString().padStart(4);
        table += `${n} |${p95} |${p99} |${err}% |${rps}\n`;
    }
    
    return table;
}

export default {
    slaDefinitions,
    degradationPolicies,
    buildThresholds,
    contractTestOptions,
    baselineTestOptions,
    stressTestOptions,
    spikeTestOptions,
    getSLAStatus,
    formatSLATable,
};
