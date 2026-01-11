/**
 * Expected response patterns for error testing
 */

export const expectedErrors = {
    // Common HTTP errors
    badRequest: {
        status: 400,
        pattern: /bad request|invalid|validation/i,
    },
    unauthorized: {
        status: 401,
        pattern: /unauthorized|missing.*header|authentication/i,
    },
    forbidden: {
        status: 403,
        pattern: /forbidden|not allowed|permission/i,
    },
    notFound: {
        status: 404,
        pattern: /not found|does not exist/i,
    },
    serverError: {
        status: 500,
        pattern: /internal.*error|server error/i,
    },
    
    // Domain-specific errors
    invalidAddress: {
        status: 400,
        pattern: /invalid.*address|address.*invalid/i,
    },
    invalidTxHash: {
        status: 400,
        pattern: /invalid.*transaction|invalid.*hash/i,
    },
};

// Risk level boundaries
export const riskLevelBoundaries = {
    low: { min: 0.0, max: 0.25 },
    medium: { min: 0.25, max: 0.50 },
    high: { min: 0.50, max: 0.75 },
    critical: { min: 0.75, max: 1.0 },
};

// Get expected risk level from score
export function expectedRiskLevel(score) {
    if (score < 0.25) return 'low';
    if (score < 0.50) return 'medium';
    if (score < 0.75) return 'high';
    return 'critical';
}

// Validate risk level matches score
export function validateRiskLevel(score, level) {
    const expected = expectedRiskLevel(score);
    return level === expected;
}

// Expected pagination defaults
export const paginationDefaults = {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100,
};

// Expected alert severities
export const alertSeverities = ['low', 'medium', 'high', 'critical'];

// Expected alert statuses
export const alertStatuses = ['pending', 'sent', 'acknowledged', 'resolved', 'failed'];

// Expected channel types
export const channelTypes = ['email', 'webhook', 'slack', 'telegram'];

// Expected rule types
export const ruleTypes = [
    'risk_score',
    'transaction_value',
    'tag_match',
    'velocity',
    'cluster_risk',
    'graph_pattern',
];

// Expected networks
export const networks = ['ethereum', 'bsc', 'polygon'];

// Health check expected response
export const healthyResponse = {
    statusOk: (status) => status === 200,
    hasStatus: (body) => body && (body.status === 'healthy' || body.status === 'ok'),
};

export default {
    expectedErrors,
    riskLevelBoundaries,
    expectedRiskLevel,
    validateRiskLevel,
    paginationDefaults,
    alertSeverities,
    alertStatuses,
    channelTypes,
    ruleTypes,
    networks,
    healthyResponse,
};
