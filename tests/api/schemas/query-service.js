/**
 * Query Service response schemas (from OpenAPI)
 */

export const AddressInfoResponse = {
    type: 'object',
    required: ['success'],
    properties: {
        success: { type: 'boolean' },
        data: {
            type: 'object',
            properties: {
                address: { type: 'string' },
                network: { type: 'string' },
                firstSeen: { type: ['string', 'null'] },
                lastSeen: { type: ['string', 'null'] },
                totalTxCount: { type: 'number' },
                sentTxCount: { type: 'number' },
                receivedTxCount: { type: 'number' },
                uniqueInteracted: { type: 'number' },
            },
        },
        error: {
            type: 'object',
            properties: {
                code: { type: 'string' },
                message: { type: 'string' },
            },
        },
    },
};

export const AddressStatsResponse = {
    type: 'object',
    required: ['success'],
    properties: {
        success: { type: 'boolean' },
        data: {
            type: 'object',
            properties: {
                totalValueSent: { type: 'string' },
                totalValueReceived: { type: 'string' },
                avgTxValue: { type: 'string' },
                maxTxValue: { type: 'string' },
                minTxValue: { type: 'string' },
            },
        },
    },
};

export const TransferResponse = {
    type: 'object',
    properties: {
        id: { type: 'number' },
        txHash: { type: 'string' },
        blockNumber: { type: 'number' },
        logIndex: { type: 'number' },
        fromAddress: { type: 'string' },
        toAddress: { type: 'string' },
        value: { type: 'string' },
        timestamp: { type: 'string' },
        transferType: { type: 'string' },
        network: { type: 'string' },
        tokenAddress: { type: ['string', 'null'] },
        tokenSymbol: { type: ['string', 'null'] },
        tokenDecimal: { type: ['number', 'null'] },
    },
};

export const TransfersListResponse = {
    type: 'object',
    required: ['success'],
    properties: {
        success: { type: 'boolean' },
        data: {
            type: 'array',
            items: TransferResponse,
        },
        meta: {
            type: 'object',
            properties: {
                page: { type: 'number' },
                pageSize: { type: 'number' },
                totalItems: { type: 'number' },
                totalPages: { type: 'number' },
            },
        },
    },
};

export const TransfersByTxResponse = {
    type: 'object',
    required: ['success'],
    properties: {
        success: { type: 'boolean' },
        data: {
            type: 'array',
            items: TransferResponse,
        },
    },
};

export const CacheStatsResponse = {
    type: 'object',
    required: ['success'],
    properties: {
        success: { type: 'boolean' },
        data: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                message: { type: 'string' },
                stats: {
                    type: 'object',
                    properties: {
                        hitRate: { type: 'string' },
                        hits: { type: 'number' },
                        misses: { type: 'number' },
                        keys: { type: 'number' },
                        memoryUsed: { type: 'string' },
                    },
                },
            },
        },
    },
};

export default {
    AddressInfoResponse,
    AddressStatsResponse,
    TransferResponse,
    TransfersListResponse,
    TransfersByTxResponse,
    CacheStatsResponse,
};
