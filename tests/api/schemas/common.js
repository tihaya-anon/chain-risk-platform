/**
 * Common schema definitions shared across services
 */

export const APIResponse = {
    type: 'object',
    required: ['success'],
    properties: {
        success: { type: 'boolean' },
        data: {},
        meta: {},
        error: { $ref: '#/definitions/APIError' },
    },
};

export const APIError = {
    type: 'object',
    properties: {
        code: { type: 'string' },
        message: { type: 'string' },
    },
};

export const PaginationMeta = {
    type: 'object',
    properties: {
        page: { type: 'number' },
        pageSize: { type: 'number' },
        totalItems: { type: 'number' },
        totalPages: { type: 'number' },
    },
};

export const HealthResponse = {
    type: 'object',
    properties: {
        status: { type: 'string' },
        service: { type: 'string' },
        time: { type: 'string' },
    },
};

export const RiskLevel = {
    type: 'string',
    enum: ['low', 'medium', 'high', 'critical'],
};

export const Severity = {
    type: 'string',
    enum: ['low', 'medium', 'high', 'critical'],
};

export const EthereumAddress = {
    type: 'string',
    pattern: '^0x[a-fA-F0-9]{40}$',
};

export const TxHash = {
    type: 'string',
    pattern: '^0x[a-fA-F0-9]{64}$',
};

export const DateTimeString = {
    type: 'string',
    format: 'date-time',
};

export default {
    APIResponse,
    APIError,
    PaginationMeta,
    HealthResponse,
    RiskLevel,
    Severity,
    EthereumAddress,
    TxHash,
    DateTimeString,
};
