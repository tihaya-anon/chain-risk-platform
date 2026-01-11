/**
 * Risk ML Service response schemas (from OpenAPI)
 */

export const RiskFactor = {
    type: 'object',
    required: ['name', 'score', 'description'],
    properties: {
        name: { type: 'string' },
        score: { type: 'number', minimum: 0, maximum: 1 },
        weight: { type: 'number' },
        description: { type: 'string' },
        triggered: { type: 'boolean' },
    },
};

export const RiskScoreResponse = {
    type: 'object',
    required: ['address', 'network', 'risk_score', 'risk_level'],
    properties: {
        address: { type: 'string' },
        network: { type: 'string' },
        risk_score: { type: 'number', minimum: 0, maximum: 1 },
        risk_level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
        },
        factors: {
            type: 'array',
            items: RiskFactor,
        },
        tags: {
            type: 'array',
            items: { type: 'string' },
        },
        evaluated_at: { type: 'string' },
        cached: { type: 'boolean' },
    },
};

export const BatchRiskScoreResponse = {
    type: 'object',
    required: ['results', 'total'],
    properties: {
        results: {
            type: 'array',
            items: RiskScoreResponse,
        },
        total: { type: 'number' },
        failed: { type: 'number' },
    },
};

export const RiskRule = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        weight: { type: 'number' },
        enabled: { type: 'boolean' },
    },
};

export const RiskRulesListResponse = {
    type: 'array',
    items: {
        type: 'object',
    },
};

export const ValidationError = {
    type: 'object',
    properties: {
        detail: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    loc: { type: 'array' },
                    msg: { type: 'string' },
                    type: { type: 'string' },
                },
            },
        },
    },
};

export default {
    RiskFactor,
    RiskScoreResponse,
    BatchRiskScoreResponse,
    RiskRule,
    RiskRulesListResponse,
    ValidationError,
};
