/**
 * BFF response schemas (from OpenAPI)
 */

// Auth
export const LoginResponse = {
    type: 'object',
    required: ['accessToken', 'tokenType', 'expiresIn'],
    properties: {
        accessToken: { type: 'string' },
        tokenType: { type: 'string' },
        expiresIn: { type: 'string' },
    },
};

export const UserProfileResponse = {
    type: 'object',
    required: ['id', 'username', 'role'],
    properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        role: {
            type: 'string',
            enum: ['admin', 'user'],
        },
    },
};

// Address
export const AddressInfoResponse = {
    type: 'object',
    required: ['address'],
    properties: {
        address: { type: 'string' },
        firstSeen: { type: ['string', 'null'] },
        lastSeen: { type: ['string', 'null'] },
        txCount: { type: 'number' },
        riskScore: { type: 'number' },
        tags: {
            type: 'array',
            items: { type: 'string' },
        },
        clusterId: { type: ['string', 'null'] },
        network: { type: 'string' },
        incomingCount: { type: 'number' },
        outgoingCount: { type: 'number' },
    },
};

export const TransferResponse = {
    type: 'object',
    required: ['id', 'txHash', 'blockNumber', 'fromAddress', 'toAddress', 'value', 'timestamp', 'transferType', 'network'],
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

export const PaginationMetadata = {
    type: 'object',
    required: ['page', 'pageSize', 'total', 'totalPages'],
    properties: {
        page: { type: 'number' },
        pageSize: { type: 'number' },
        total: { type: 'number' },
        totalPages: { type: 'number' },
    },
};

export const PaginatedTransfersResponse = {
    type: 'object',
    required: ['items', 'pagination'],
    properties: {
        items: {
            type: 'array',
            items: TransferResponse,
        },
        pagination: PaginationMetadata,
    },
};

// Risk
export const RiskFactorResponse = {
    type: 'object',
    required: ['name', 'score', 'weight', 'description', 'triggered'],
    properties: {
        name: { type: 'string' },
        score: { type: 'number' },
        weight: { type: 'number' },
        description: { type: 'string' },
        triggered: { type: 'boolean' },
    },
};

export const RiskScoreResponse = {
    type: 'object',
    required: ['address', 'network', 'riskScore', 'riskLevel', 'factors', 'tags', 'evaluatedAt', 'cached'],
    properties: {
        address: { type: 'string' },
        network: { type: 'string' },
        riskScore: { type: 'number', minimum: 0, maximum: 1 },
        riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
        },
        factors: {
            type: 'array',
            items: RiskFactorResponse,
        },
        tags: {
            type: 'array',
            items: { type: 'string' },
        },
        evaluatedAt: { type: 'string' },
        cached: { type: 'boolean' },
    },
};

export const BatchRiskScoreResponse = {
    type: 'object',
    required: ['results', 'total', 'failed'],
    properties: {
        results: {
            type: 'array',
            items: RiskScoreResponse,
        },
        total: { type: 'number' },
        failed: { type: 'number' },
    },
};

// Alerts
export const AlertRuleResponse = {
    type: 'object',
    required: ['id', 'name', 'description', 'ruleType', 'severity', 'conditions', 'enabled', 'createdAt', 'updatedAt'],
    properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' },
        ruleType: {
            type: 'string',
            enum: ['risk_score', 'transaction_value', 'tag_match', 'velocity', 'cluster_risk'],
        },
        severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
        },
        conditions: { type: 'object' },
        enabled: { type: 'boolean' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
    },
};

export const AlertHistoryResponse = {
    type: 'object',
    required: ['id', 'alertType', 'severity', 'entityType', 'entityId', 'title', 'message', 'status', 'createdAt'],
    properties: {
        id: { type: 'number' },
        ruleId: { type: ['number', 'null'] },
        alertType: { type: 'string' },
        severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
        },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        metadata: { type: 'object' },
        status: {
            type: 'string',
            enum: ['pending', 'sent', 'acknowledged', 'resolved'],
        },
        notifiedAt: { type: ['string', 'null'] },
        acknowledgedAt: { type: ['string', 'null'] },
        acknowledgedBy: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
    },
};

export const AlertHistoryListResponse = {
    type: 'object',
    required: ['data', 'total', 'page', 'pageSize'],
    properties: {
        data: {
            type: 'array',
            items: AlertHistoryResponse,
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
    },
};

export const AlertStatsResponse = {
    type: 'object',
    required: ['total', 'bySeverity', 'byStatus', 'byType', 'averagePerHour'],
    properties: {
        total: { type: 'number' },
        bySeverity: { type: 'object' },
        byStatus: { type: 'object' },
        byType: { type: 'object' },
        averagePerHour: { type: 'number' },
    },
};

export const SubscriptionResponse = {
    type: 'object',
    required: ['id', 'userId', 'channelType', 'channelConfig', 'enabled', 'createdAt', 'updatedAt'],
    properties: {
        id: { type: 'number' },
        userId: { type: 'string' },
        ruleId: { type: ['number', 'null'] },
        channelType: {
            type: 'string',
            enum: ['email', 'webhook', 'slack', 'telegram'],
        },
        channelConfig: { type: 'object' },
        enabled: { type: 'boolean' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
    },
};

export const TestAlertResponse = {
    type: 'object',
    required: ['success', 'message'],
    properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
    },
};

// Graph (via BFF)
export const GraphNode = {
    type: 'object',
    required: ['address'],
    properties: {
        address: { type: 'string' },
        distance: { type: 'number' },
        riskScore: { type: 'number' },
        tags: {
            type: 'array',
            items: { type: 'string' },
        },
        firstSeen: { type: ['string', 'null'] },
        lastSeen: { type: ['string', 'null'] },
    },
};

export const GraphEdge = {
    type: 'object',
    required: ['from', 'to'],
    properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        transferCount: { type: 'number' },
        totalValue: { type: 'string' },
        lastTransfer: { type: ['string', 'null'] },
    },
};

export const AddressNeighborsResponse = {
    type: 'object',
    required: ['address', 'nodes', 'edges'],
    properties: {
        address: { type: 'string' },
        depth: { type: 'number' },
        nodes: {
            type: 'array',
            items: GraphNode,
        },
        edges: {
            type: 'array',
            items: GraphEdge,
        },
    },
};

export const ClusterResponse = {
    type: 'object',
    required: ['clusterId'],
    properties: {
        clusterId: { type: 'string' },
        size: { type: 'number' },
        riskScore: { type: 'number' },
        label: { type: ['string', 'null'] },
        category: { type: ['string', 'null'] },
        tags: {
            type: 'array',
            items: { type: 'string' },
        },
        addresses: {
            type: 'array',
            items: { type: 'string' },
        },
        createdAt: { type: ['string', 'null'] },
        updatedAt: { type: ['string', 'null'] },
        network: { type: 'string' },
    },
};

export const PathNode = {
    type: 'object',
    required: ['address'],
    properties: {
        address: { type: 'string' },
        txHash: { type: ['string', 'null'] },
        value: { type: ['string', 'null'] },
        timestamp: { type: ['string', 'null'] },
        riskScore: { type: 'number' },
        tags: {
            type: 'array',
            items: { type: 'string' },
        },
    },
};

export const PathResponse = {
    type: 'object',
    required: ['found', 'fromAddress', 'toAddress'],
    properties: {
        found: { type: 'boolean' },
        fromAddress: { type: 'string' },
        toAddress: { type: 'string' },
        pathLength: { type: 'number' },
        maxDepth: { type: 'number' },
        message: { type: ['string', 'null'] },
        path: {
            type: 'array',
            items: PathNode,
        },
    },
};

export const ClusteringResultResponse = {
    type: 'object',
    required: ['status'],
    properties: {
        status: { type: 'string' },
        clustersCreated: { type: 'number' },
        addressesClustered: { type: 'number' },
        durationMs: { type: 'number' },
        startedAt: { type: ['string', 'null'] },
        completedAt: { type: ['string', 'null'] },
        errorMessage: { type: ['string', 'null'] },
    },
};

export const PropagationResultResponse = {
    type: 'object',
    required: ['status'],
    properties: {
        status: { type: 'string' },
        addressesAffected: { type: 'number' },
        tagsPropagated: { type: 'number' },
        maxHops: { type: 'number' },
        decayFactor: { type: 'number' },
        durationMs: { type: 'number' },
        startedAt: { type: ['string', 'null'] },
        completedAt: { type: ['string', 'null'] },
        errorMessage: { type: ['string', 'null'] },
    },
};

export default {
    LoginResponse,
    UserProfileResponse,
    AddressInfoResponse,
    TransferResponse,
    PaginationMetadata,
    PaginatedTransfersResponse,
    RiskFactorResponse,
    RiskScoreResponse,
    BatchRiskScoreResponse,
    AlertRuleResponse,
    AlertHistoryResponse,
    AlertHistoryListResponse,
    AlertStatsResponse,
    SubscriptionResponse,
    TestAlertResponse,
    GraphNode,
    GraphEdge,
    AddressNeighborsResponse,
    ClusterResponse,
    PathNode,
    PathResponse,
    ClusteringResultResponse,
    PropagationResultResponse,
};
