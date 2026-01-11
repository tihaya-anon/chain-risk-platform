/**
 * Alert Service response schemas (from OpenAPI)
 */

export const AlertRule = {
    type: 'object',
    properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' },
        rule_type: {
            type: 'string',
            enum: ['risk_score', 'transaction_value', 'tag_match', 'graph_pattern', 'velocity', 'cluster_risk'],
        },
        conditions: { type: 'object' },
        severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
        },
        enabled: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
    },
};

export const AlertRulesListResponse = {
    type: 'object',
    properties: {
        data: {
            type: ['array', 'null'],  // Allow null for empty results
            items: AlertRule,
        },
    },
};

export const AlertHistory = {
    type: 'object',
    properties: {
        id: { type: 'number' },
        rule_id: { type: 'number' },
        alert_type: { type: 'string' },
        severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
        },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        metadata: { type: 'object' },
        status: {
            type: 'string',
            enum: ['pending', 'sent', 'failed', 'acknowledged'],
        },
        notified_at: { type: ['string', 'null'] },
        created_at: { type: 'string' },
    },
};

export const AlertHistoryListResponse = {
    type: 'object',
    properties: {
        data: {
            type: ['array', 'null'],  // Allow null for empty results
            items: AlertHistory,
        },
    },
};

export const AlertStats = {
    type: 'object',
    properties: {
        data: {
            type: 'object',
            properties: {
                total: { type: 'number' },
                by_severity: { type: 'object' },
                by_status: { type: 'object' },
                by_type: { type: 'object' },
                average_per_hour: { type: 'number' },
            },
        },
        period: {
            type: 'object',
            properties: {
                from: { type: 'string' },
                to: { type: 'string' },
            },
        },
    },
};

export const Subscription = {
    type: 'object',
    properties: {
        id: { type: 'number' },
        user_id: { type: 'string' },
        rule_id: { type: ['number', 'null'] },
        channel_type: {
            type: 'string',
            enum: ['email', 'webhook', 'slack', 'telegram'],
        },
        channel_config: { type: 'object' },
        enabled: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
    },
};

export const SubscriptionsListResponse = {
    type: 'object',
    properties: {
        data: {
            type: ['array', 'null'],  // Allow null for empty results
            items: Subscription,
        },
    },
};

export default {
    AlertRule,
    AlertRulesListResponse,
    AlertHistory,
    AlertHistoryListResponse,
    AlertStats,
    Subscription,
    SubscriptionsListResponse,
};
