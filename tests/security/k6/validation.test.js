/**
 * Input Validation Integration Test
 * Validates input validation and security controls across all services
 */
import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// Custom metrics
const validationPassed = new Rate('validation_passed');
const injectionBlocked = new Counter('injection_blocked');
const invalidInputRejected = new Counter('invalid_input_rejected');

// Configuration
const BASE_URLS = {
  queryService: __ENV.QUERY_SERVICE_URL || 'http://localhost:8081',
  alertService: __ENV.ALERT_SERVICE_URL || 'http://localhost:8083',
  riskService: __ENV.RISK_SERVICE_URL || 'http://localhost:8082',
  graphService: __ENV.GRAPH_SERVICE_URL || 'http://localhost:8084',
  bff: __ENV.BFF_URL || 'http://localhost:3001',
};

export const options = {
  scenarios: {
    validation_tests: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '5m',
    },
  },
  thresholds: {
    'validation_passed': ['rate>0.9'],
    'injection_blocked': ['count>=10'],
    'invalid_input_rejected': ['count>=5'],
  },
};

// Test cases for input validation
const validAddresses = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00',
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
];

const invalidAddresses = [
  { input: 'invalid', desc: 'non-hex string' },
  { input: '0x123', desc: 'too short' },
  { input: '0x' + 'G'.repeat(40), desc: 'invalid hex chars' },
  { input: '', desc: 'empty string' },
  { input: '0x' + '0'.repeat(50), desc: 'too long' },
];

const sqlInjectionPatterns = [
  "'; DROP TABLE addresses;--",
  "1' OR '1'='1",
  "' UNION SELECT * FROM users--",
  "1; DELETE FROM addresses WHERE '1'='1",
  "admin'--",
];

const xssPatterns = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg onload=alert(1)>',
  '"><script>alert(1)</script>',
];

const pathTraversalPatterns = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '%2e%2e%2f%2e%2e%2f',
  '....//....//etc/passwd',
];

const commandInjectionPatterns = [
  '; cat /etc/passwd',
  '| ls -la',
  '`whoami`',
  '$(cat /etc/passwd)',
  '& dir',
];

export default function () {
  // Test each service
  for (const [serviceName, baseUrl] of Object.entries(BASE_URLS)) {
    group(`${serviceName} validation`, () => {
      testValidAddresses(serviceName, baseUrl);
      testInvalidAddresses(serviceName, baseUrl);
      testSQLInjection(serviceName, baseUrl);
      testXSS(serviceName, baseUrl);
      testPathTraversal(serviceName, baseUrl);
      testCommandInjection(serviceName, baseUrl);
    });
  }
}

function testValidAddresses(serviceName, baseUrl) {
  group('valid addresses', () => {
    for (const addr of validAddresses) {
      const endpoint = getAddressEndpoint(serviceName, baseUrl, addr);
      const res = http.get(endpoint);
      
      const passed = check(res, {
        [`${serviceName}: valid address accepted`]: (r) => 
          r.status !== 400 && r.status !== 422,
      });
      
      validationPassed.add(passed ? 1 : 0);
    }
  });
}

function testInvalidAddresses(serviceName, baseUrl) {
  group('invalid addresses', () => {
    for (const testCase of invalidAddresses) {
      const endpoint = getAddressEndpoint(serviceName, baseUrl, testCase.input);
      const res = http.get(endpoint);
      
      const passed = check(res, {
        [`${serviceName}: ${testCase.desc} rejected`]: (r) => 
          r.status === 400 || r.status === 422,
      });
      
      if (passed) {
        invalidInputRejected.add(1);
      }
      validationPassed.add(passed ? 1 : 0);
    }
  });
}

function testSQLInjection(serviceName, baseUrl) {
  group('SQL injection', () => {
    for (const pattern of sqlInjectionPatterns) {
      const encoded = encodeURIComponent(pattern);
      const endpoint = getAddressEndpoint(serviceName, baseUrl, encoded);
      const res = http.get(endpoint);
      
      const blocked = check(res, {
        [`${serviceName}: SQL injection blocked`]: (r) => 
          r.status === 400 || r.status === 422 || r.status === 403,
      });
      
      if (blocked) {
        injectionBlocked.add(1);
      }
      validationPassed.add(blocked ? 1 : 0);
    }
  });
}

function testXSS(serviceName, baseUrl) {
  group('XSS attacks', () => {
    for (const pattern of xssPatterns) {
      const encoded = encodeURIComponent(pattern);
      const endpoint = getAddressEndpoint(serviceName, baseUrl, encoded);
      const res = http.get(endpoint);
      
      const blocked = check(res, {
        [`${serviceName}: XSS blocked`]: (r) => 
          r.status === 400 || r.status === 422 || r.status === 403,
        [`${serviceName}: XSS not reflected`]: (r) => 
          !r.body.includes(pattern),
      });
      
      if (blocked) {
        injectionBlocked.add(1);
      }
      validationPassed.add(blocked ? 1 : 0);
    }
  });
}

function testPathTraversal(serviceName, baseUrl) {
  group('path traversal', () => {
    for (const pattern of pathTraversalPatterns) {
      const encoded = encodeURIComponent(pattern);
      const endpoint = getAddressEndpoint(serviceName, baseUrl, encoded);
      const res = http.get(endpoint);
      
      const blocked = check(res, {
        [`${serviceName}: path traversal blocked`]: (r) => 
          r.status === 400 || r.status === 422 || r.status === 403 || r.status === 404,
        [`${serviceName}: no sensitive data leaked`]: (r) => 
          !r.body.includes('root:') && !r.body.includes('Administrator'),
      });
      
      if (blocked) {
        injectionBlocked.add(1);
      }
      validationPassed.add(blocked ? 1 : 0);
    }
  });
}

function testCommandInjection(serviceName, baseUrl) {
  group('command injection', () => {
    for (const pattern of commandInjectionPatterns) {
      const encoded = encodeURIComponent(pattern);
      const endpoint = getAddressEndpoint(serviceName, baseUrl, encoded);
      const res = http.get(endpoint);
      
      const blocked = check(res, {
        [`${serviceName}: command injection blocked`]: (r) => 
          r.status === 400 || r.status === 422 || r.status === 403,
      });
      
      if (blocked) {
        injectionBlocked.add(1);
      }
      validationPassed.add(blocked ? 1 : 0);
    }
  });
}

function getAddressEndpoint(serviceName, baseUrl, address) {
  const endpoints = {
    queryService: `${baseUrl}/api/v1/addresses/${address}`,
    alertService: `${baseUrl}/api/v1/alerts/address/${address}`,
    riskService: `${baseUrl}/api/v1/risk/${address}`,
    graphService: `${baseUrl}/api/v1/graph/address/${address}`,
    bff: `${baseUrl}/api/v1/addresses/${address}`,
  };
  return endpoints[serviceName] || `${baseUrl}/api/v1/address/${address}`;
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test: 'validation-integration',
    metrics: {
      validationPassRate: data.metrics.validation_passed?.values?.rate || 0,
      injectionsBlocked: data.metrics.injection_blocked?.values?.count || 0,
      invalidInputsRejected: data.metrics.invalid_input_rejected?.values?.count || 0,
    },
    thresholds: data.thresholds,
    pass: Object.values(data.thresholds || {}).every(t => t.ok !== false),
  };

  return {
    'tests/security/k6/results/validation-summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
