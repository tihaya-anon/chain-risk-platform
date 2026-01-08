/**
 * Mock data generators for realistic blockchain data
 */

import { faker } from "@faker-js/faker"

// ==================== Basic Generators ====================

export function mockAddress(): string {
  return "0x" + faker.string.hexadecimal({ length: 40, casing: "lower" }).slice(2)
}

export function mockTxHash(): string {
  return "0x" + faker.string.hexadecimal({ length: 64, casing: "lower" }).slice(2)
}

export function mockEthValue(): string {
  return faker.number.bigInt({ min: 1000000000000000n, max: 100000000000000000000n }).toString()
}

export function mockTimestamp(): string {
  return faker.date.recent({ days: 365 }).toISOString()
}

export function mockRiskLevel(): "low" | "medium" | "high" | "critical" {
  return faker.helpers.arrayElement(["low", "medium", "high", "critical"])
}

export function mockRiskScore(): number {
  return faker.number.float({ min: 0, max: 1, fractionDigits: 2 })
}

const RISK_TAGS = ["mixer", "exchange", "gambling", "scam", "darknet", "sanctioned", "high-volume", "smart-contract", "dex", "defi"]

export function mockTags(count: number = 3): string[] {
  return faker.helpers.arrayElements(RISK_TAGS, { min: 1, max: count })
}

// ==================== Risk & Address Generators ====================

export function mockRiskFactor() {
  return {
    name: faker.helpers.arrayElement(["High Transaction Volume", "Mixer Interaction", "Sanctioned Entity", "New Address", "Unusual Pattern"]),
    score: mockRiskScore(),
    weight: faker.number.float({ min: 0.1, max: 0.5, fractionDigits: 2 }),
    description: faker.lorem.sentence(),
    triggered: faker.datatype.boolean(),
  }
}

export function mockAddressInfo(address?: string) {
  return {
    address: address || mockAddress(),
    network: "ethereum",
    firstSeen: mockTimestamp(),
    lastSeen: mockTimestamp(),
    totalTxCount: faker.number.int({ min: 10, max: 10000 }),
    sentTxCount: faker.number.int({ min: 5, max: 5000 }),
    receivedTxCount: faker.number.int({ min: 5, max: 5000 }),
    uniqueInteracted: faker.number.int({ min: 5, max: 500 }),
  }
}

export function mockRiskScoreResponse(address?: string) {
  return {
    address: address || mockAddress(),
    network: "ethereum",
    riskScore: mockRiskScore(),
    riskLevel: mockRiskLevel(),
    factors: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, mockRiskFactor),
    tags: mockTags(5),
    evaluatedAt: mockTimestamp(),
    cached: faker.datatype.boolean(),
  }
}

export function mockGraphAddressInfo(address?: string) {
  return {
    address: address || mockAddress(),
    firstSeen: mockTimestamp(),
    lastSeen: mockTimestamp(),
    txCount: faker.number.int({ min: 10, max: 10000 }),
    riskScore: mockRiskScore(),
    tags: mockTags(4),
    clusterId: faker.string.uuid(),
    network: "ethereum",
    incomingCount: faker.number.int({ min: 5, max: 5000 }),
    outgoingCount: faker.number.int({ min: 5, max: 5000 }),
  }
}

// Graph Node for subgraph response
export function mockGraphNode(address?: string, distance: number = 1) {
  return {
    address: address || mockAddress(),
    distance,
    riskScore: mockRiskScore(),
    tags: mockTags(3),
    firstSeen: mockTimestamp(),
    lastSeen: mockTimestamp(),
  }
}

// Graph Edge for subgraph response
export function mockGraphEdge(from: string, to: string) {
  return {
    from,
    to,
    transferCount: faker.number.int({ min: 1, max: 100 }),
    totalValue: mockEthValue(),
    lastTransfer: mockTimestamp(),
  }
}

export function mockClusterResponse() {
  return {
    clusterId: faker.string.uuid(),
    size: faker.number.int({ min: 2, max: 50 }),
    riskScore: mockRiskScore(),
    label: faker.helpers.arrayElement(["Exchange Hot Wallet", "Mining Pool", "DeFi Protocol", "Unknown Entity", null]),
    category: faker.helpers.arrayElement(["exchange", "defi", "mixer", "other", null]),
    tags: mockTags(3),
    addresses: Array.from({ length: faker.number.int({ min: 2, max: 10 }) }, mockAddress),
    createdAt: mockTimestamp(),
    updatedAt: mockTimestamp(),
    network: "ethereum",
  }
}

export function mockTransfer() {
  return {
    id: faker.number.int({ min: 1, max: 1000000 }),
    txHash: mockTxHash(),
    blockNumber: faker.number.int({ min: 15000000, max: 19000000 }),
    fromAddress: mockAddress(),
    toAddress: mockAddress(),
    value: mockEthValue(),
    timestamp: mockTimestamp(),
    transferType: faker.helpers.arrayElement(["ETH", "ERC20", "ERC721"]),
    network: "ethereum",
  }
}

export function mockPathNode() {
  return {
    address: mockAddress(),
    txHash: mockTxHash(),
    value: mockEthValue(),
    timestamp: mockTimestamp(),
    riskScore: mockRiskScore(),
    tags: mockTags(2),
  }
}

// ==================== Orchestration Response Generators ====================

export function mockAddressAnalysisResponse(address?: string) {
  const addr = address || mockAddress()
  const neighborsResponse = mockNeighborsResponse(addr)
  
  return {
    address: addr,
    network: "ethereum",
    basic: {
      addressInfo: mockAddressInfo(addr),
      riskScore: mockRiskScoreResponse(addr),
    },
    graph: {
      graphInfo: mockGraphAddressInfo(addr),
      neighbors: neighborsResponse,
      tags: mockTags(5),
      cluster: mockClusterResponse(),
    },
    orchestratedAt: Date.now(),
  }
}

export function mockHighRiskNetworkResponse() {
  const addresses = [
    // Critical (>= 0.8)
    ...Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () => ({
      address: mockAddress(),
      firstSeen: mockTimestamp(),
      lastSeen: mockTimestamp(),
      txCount: faker.number.int({ min: 100, max: 10000 }),
      riskScore: faker.number.float({ min: 0.8, max: 1, fractionDigits: 2 }),
      tags: mockTags(4),
      clusterId: faker.string.uuid(),
      network: "ethereum",
      incomingCount: faker.number.int({ min: 50, max: 5000 }),
      outgoingCount: faker.number.int({ min: 50, max: 5000 }),
    })),
    // High (0.6 - 0.8)
    ...Array.from({ length: faker.number.int({ min: 3, max: 5 }) }, () => ({
      address: mockAddress(),
      firstSeen: mockTimestamp(),
      lastSeen: mockTimestamp(),
      txCount: faker.number.int({ min: 100, max: 10000 }),
      riskScore: faker.number.float({ min: 0.6, max: 0.79, fractionDigits: 2 }),
      tags: mockTags(4),
      clusterId: faker.string.uuid(),
      network: "ethereum",
      incomingCount: faker.number.int({ min: 50, max: 5000 }),
      outgoingCount: faker.number.int({ min: 50, max: 5000 }),
    })),
    // Medium (0.4 - 0.6)
    ...Array.from({ length: faker.number.int({ min: 4, max: 6 }) }, () => ({
      address: mockAddress(),
      firstSeen: mockTimestamp(),
      lastSeen: mockTimestamp(),
      txCount: faker.number.int({ min: 100, max: 10000 }),
      riskScore: faker.number.float({ min: 0.4, max: 0.59, fractionDigits: 2 }),
      tags: mockTags(4),
      clusterId: faker.string.uuid(),
      network: "ethereum",
      incomingCount: faker.number.int({ min: 50, max: 5000 }),
      outgoingCount: faker.number.int({ min: 50, max: 5000 }),
    })),
    // Low (< 0.4)
    ...Array.from({ length: faker.number.int({ min: 3, max: 5 }) }, () => ({
      address: mockAddress(),
      firstSeen: mockTimestamp(),
      lastSeen: mockTimestamp(),
      txCount: faker.number.int({ min: 100, max: 10000 }),
      riskScore: faker.number.float({ min: 0.1, max: 0.39, fractionDigits: 2 }),
      tags: mockTags(4),
      clusterId: faker.string.uuid(),
      network: "ethereum",
      incomingCount: faker.number.int({ min: 50, max: 5000 }),
      outgoingCount: faker.number.int({ min: 50, max: 5000 }),
    })),
  ]

  return {
    threshold: 0.7,
    count: addresses.length,
    highRiskAddresses: addresses,
    orchestratedAt: Date.now(),
  }
}

export function mockConnectionResponse(fromAddress?: string, toAddress?: string) {
  const from = fromAddress || mockAddress()
  const to = toAddress || mockAddress()
  const pathLength = faker.number.int({ min: 2, max: 5 })

  return {
    fromAddress: from,
    toAddress: to,
    path: {
      found: true,
      fromAddress: from,
      toAddress: to,
      pathLength,
      maxDepth: 6,
      message: "Path found",
      path: Array.from({ length: pathLength }, mockPathNode),
    },
    fromAddressRisk: mockRiskScoreResponse(from),
    toAddressRisk: mockRiskScoreResponse(to),
    orchestratedAt: Date.now(),
  }
}

/**
 * Mock neighbors response with subgraph structure (nodes + edges)
 */
export function mockNeighborsResponse(address?: string, depth: number = 1) {
  const centerAddr = address || mockAddress()
  
  // Generate neighbor addresses with different directions
  const incomingCount = faker.number.int({ min: 2, max: 5 })
  const outgoingCount = faker.number.int({ min: 2, max: 5 })
  const bothCount = faker.number.int({ min: 1, max: 3 })
  
  const incomingAddrs = Array.from({ length: incomingCount }, mockAddress)
  const outgoingAddrs = Array.from({ length: outgoingCount }, mockAddress)
  const bothAddrs = Array.from({ length: bothCount }, mockAddress)

  // Build nodes array (center + all neighbors)
  const nodes = [
    mockGraphNode(centerAddr, 0), // center node at distance 0
    ...incomingAddrs.map(addr => mockGraphNode(addr, 1)),
    ...outgoingAddrs.map(addr => mockGraphNode(addr, 1)),
    ...bothAddrs.map(addr => mockGraphNode(addr, 1)),
  ]

  // Build edges array
  const edges = [
    // Incoming edges: neighbor -> center
    ...incomingAddrs.map(addr => mockGraphEdge(addr, centerAddr)),
    // Outgoing edges: center -> neighbor
    ...outgoingAddrs.map(addr => mockGraphEdge(centerAddr, addr)),
    // Both directions
    ...bothAddrs.flatMap(addr => [
      mockGraphEdge(addr, centerAddr),
      mockGraphEdge(centerAddr, addr),
    ]),
  ]

  return {
    address: centerAddr,
    depth,
    nodes,
    edges,
  }
}

// ==================== Admin Generators ====================

export function mockPipelineStatus() {
  return {
    ingestion: {
      enabled: true,
      status: faker.helpers.arrayElement(["RUNNING", "IDLE", "PAUSED"]),
      lastBlock: faker.number.int({ min: 18000000, max: 19000000 }),
      errorMessage: faker.helpers.arrayElement([null, null, null, "Connection timeout"]),
    },
    streamProcessor: {
      enabled: true,
      status: faker.helpers.arrayElement(["RUNNING", "IDLE"]),
      processedCount: faker.number.int({ min: 100000, max: 10000000 }),
      errorCount: faker.number.int({ min: 0, max: 100 }),
    },
    graphSync: {
      enabled: true,
      status: faker.helpers.arrayElement(["RUNNING", "IDLE", "PAUSED"]),
      lastSyncTime: mockTimestamp(),
    },
    clustering: {
      enabled: true,
      status: "IDLE",
      lastRunTime: mockTimestamp(),
    },
    propagation: {
      enabled: true,
      status: "IDLE",
      lastRunTime: mockTimestamp(),
    },
  }
}

export function mockServices() {
  return [
    { name: "address-service", groupName: "chain-risk", clusterCount: 2, instanceCount: 3, healthyInstanceCount: 3 },
    { name: "risk-service", groupName: "chain-risk", clusterCount: 2, instanceCount: 2, healthyInstanceCount: 2 },
    { name: "graph-service", groupName: "chain-risk", clusterCount: 1, instanceCount: 2, healthyInstanceCount: 2 },
    { name: "transfer-service", groupName: "chain-risk", clusterCount: 2, instanceCount: 3, healthyInstanceCount: 2 },
    { name: "orchestrator", groupName: "chain-risk", clusterCount: 1, instanceCount: 2, healthyInstanceCount: 2 },
    { name: "bff", groupName: "chain-risk", clusterCount: 1, instanceCount: 2, healthyInstanceCount: 2 },
  ]
}

export function mockRiskConfig() {
  return {
    highThreshold: 0.7,
    mediumThreshold: 0.4,
    cacheTtlSeconds: 3600,
  }
}

export function mockPipelineConfig() {
  return {
    enabled: true,
    ingestion: {
      enabled: true,
      network: "ethereum",
      polling: { intervalMs: 1000, batchSize: 100 },
      rateLimit: { requestsPerSecond: 50 },
    },
    streamProcessor: {
      enabled: true,
      parallelism: 4,
      checkpoint: { intervalMs: 60000 },
      consumer: { maxPollRecords: 500 },
    },
    graphSync: {
      enabled: true,
      intervalMs: 60000,
      batchSize: 500,
    },
    clustering: {
      enabled: true,
      algorithm: "common-input",
      minClusterSize: 2,
    },
    propagation: {
      enabled: true,
      maxDepth: 3,
      decayFactor: 0.5,
    },
  }
}
