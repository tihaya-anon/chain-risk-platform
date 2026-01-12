/**
 * Rate Limit Integration Test
 * Validates rate limiting is working across all services
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const rateLimitHits = new Rate('rate_limit_hits');
const requestsBlocked = new Counter('requests_blocked');
const timeToRateLimit = new Trend('time_to_rate_limit');

// Configuration
const BASE_URLS = {
  queryService: __ENV.QUERY_SERVICE_URL || 'http://localhost:8081',
  alertService: __ENV.ALERT_SERVICE_URL || 'http://localhost:8083',
  riskService: __ENV.RISK_SERVICE_URL || 'http://localhost:8082',
  graphService: __ENV.GRAPH_SERVICE_URL || 'http://localhost:8084',
  bff: __ENV.BFF_URL || 'http://localhost:3001',
};

const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00';

export const options = {
  scenarios: {
    // Burst test: many requests quickly
    burst_test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 200,
      maxDuration: '60s',
      exec: 'burstTest',
    },
    // Sustained test: steady rate over time
    sustained_test: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      exec: 'sustainedTest',
      startTime: '65s',
    },
  },
  thresholds: {
    // At least 20% of requests should hit rate limit in burst test
    'rate_limit_hits{scenario:burst_test}': ['rate>0.2'],
    // Under sustained load, some should still be blocked
    'rate_limit_hits{scenario:sustained_test}': ['rate>0.1'],
    // Track blocked requests
    'requests_blocked': ['count>10'],
  },
};

// Test endpoints for each service
const endpoints = [
  { name: 'query-service', url: `${BASE_URLS.queryService}/api/v1/addresses/${TEST_ADDRESS}` },
  { name: 'alert-service', url: `${BASE_URLS.alertService}/api/v1/rules` },
  { name: 'risk-service', url: `${BASE_URLS.riskService}/api/v1/risk/${TEST_ADDRESS}` },
  { name: 'graph-service', url: `${BASE_URLS.graphService}/api/v1/graph/address/${TEST_ADDRESS}` },
  { name: 'bff', url: `${BASE_URLS.bff}/api/v1/addresses/${TEST_ADDRESS}` },
];

export function burstTest() {
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const startTime = Date.now();
  
  const res = http.get(endpoint.url, {
    tags: { service: endpoint.name },
  });

  const isRateLimited = res.status === 429;
  rateLimitHits.add(isRateLimited, { scenario: 'burst_test' });
  
  if (isRateLimited) {
    requestsBlocked.add(1);
    timeToRateLimit.add(Date.now() - startTime);
  }

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has rate limit headers': (r) => 
      r.headers['X-Ratelimit-Limit'] !== undefined ||
      r.headers['X-RateLimit-Limit'] !== undefined ||
      r.headers['Retry-After'] !== undefined,
  });
}

export function sustainedTest() {
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(endpoint.url, {
    tags: { service: endpoint.name },
  });

  const isRateLimited = res.status === 429;
  rateLimitHits.add(isRateLimited, { scenario: 'sustained_test' });
  
  if (isRateLimited) {
    requestsBlocked.add(1);
  }

  check(res, {
    'status is valid': (r) => [200, 429, 404].includes(r.status),
  });

  // If rate limited, wait for retry-after
  if (isRateLimited && res.headers['Retry-After']) {
    sleep(parseInt(res.headers['Retry-After']) || 1);
  }
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test: 'rate-limit-integration',
    metrics: {
      rateLimitHitRate: data.metrics.rate_limit_hits?.values?.rate || 0,
      totalRequestsBlocked: data.metrics.requests_blocked?.values?.count || 0,
      avgTimeToRateLimit: data.metrics.time_to_rate_limit?.values?.avg || 0,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false),
  };

  return {
    'tests/security/k6/results/rate-limit-summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
