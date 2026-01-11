/**
 * Graph Service response schemas (from OpenAPI)
 * Note: Many fields can be null when data doesn't exist
 */

export const AddressInfoResponse = {
    type: 'object',
    properties: {
        address: { type: 'string' },
        firstSeen: { type: ['string', 'null'] },
        lastSeen: { type: ['string', 'null'] },
        txCount: { type: ['number', 'null'] },
        riskScore: { type: ['number', 'null'] },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
        clusterId: { type: ['string', 'null'] },
        network: { type: ['string', 'null'] },
        incomingCount: { type: ['number', 'null'] },
        outgoingCount: { type: ['number', 'null'] },
    },
};

export const GraphNode = {
    type: 'object',
    properties: {
        address: { type: 'string' },
        distance: { type: ['number', 'null'] },
        riskScore: { type: ['number', 'null'] },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
        firstSeen: { type: ['string', 'null'] },
        lastSeen: { type: ['string', 'null'] },
    },
};

export const GraphEdge = {
    type: 'object',
    properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        transferCount: { type: ['number', 'null'] },
        totalValue: { type: ['string', 'null'] },
        lastTransfer: { type: ['string', 'null'] },
    },
};

export const AddressNeighborsResponse = {
    type: 'object',
    properties: {
        address: { type: 'string' },
        depth: { type: ['number', 'null'] },
        nodes: { type: ['array', 'null'], items: GraphNode },
        edges: { type: ['array', 'null'], items: GraphEdge },
    },
};

export const PathNode = {
    type: 'object',
    properties: {
        address: { type: 'string' },
        txHash: { type: ['string', 'null'] },
        value: { type: ['string', 'null'] },
        timestamp: { type: ['string', 'null'] },
        riskScore: { type: ['number', 'null'] },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
    },
};

export const PathResponse = {
    type: 'object',
    properties: {
        found: { type: 'boolean' },
        fromAddress: { type: 'string' },
        toAddress: { type: 'string' },
        pathLength: { type: ['number', 'null'] },
        maxDepth: { type: ['number', 'null'] },
        message: { type: ['string', 'null'] },
        path: { type: ['array', 'null'], items: PathNode },
    },
};

export const ClusterResponse = {
    type: 'object',
    properties: {
        clusterId: { type: 'string' },
        size: { type: ['number', 'null'] },
        riskScore: { type: ['number', 'null'] },
        label: { type: ['string', 'null'] },
        category: { type: ['string', 'null'] },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
        addresses: { type: ['array', 'null'], items: { type: 'string' } },
        createdAt: { type: ['string', 'null'] },
        updatedAt: { type: ['string', 'null'] },
        network: { type: ['string', 'null'] },
    },
};

export const PropagationResultResponse = {
    type: 'object',
    properties: {
        status: { type: 'string' },
        addressesAffected: { type: ['number', 'null'] },
        tagsPropagated: { type: ['number', 'null'] },
        maxHops: { type: ['number', 'null'] },
        decayFactor: { type: ['number', 'null'] },
        durationMs: { type: ['number', 'null'] },
        startedAt: { type: ['string', 'null'] },
        completedAt: { type: ['string', 'null'] },
        errorMessage: { type: ['string', 'null'] },
    },
};

export const ClusteringResultResponse = {
    type: 'object',
    properties: {
        status: { type: 'string' },
        clustersCreated: { type: ['number', 'null'] },
        addressesClustered: { type: ['number', 'null'] },
        durationMs: { type: ['number', 'null'] },
        startedAt: { type: ['string', 'null'] },
        completedAt: { type: ['string', 'null'] },
        errorMessage: { type: ['string', 'null'] },
    },
};

export default {
    AddressInfoResponse,
    GraphNode,
    GraphEdge,
    AddressNeighborsResponse,
    PathNode,
    PathResponse,
    ClusterResponse,
    PropagationResultResponse,
    ClusteringResultResponse,
};
