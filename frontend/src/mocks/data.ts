/**
 * Mock data generators for realistic blockchain data
 */

import { faker } from "@faker-js/faker"

// Generate realistic Ethereum address
export function mockAddress(): string {
  return "0x" + faker.string.hexadecimal({ length: 40, casing: "lower" }).slice(2)
}

// Generate realistic transaction hash
export function mockTxHash(): string {
  return "0x" + faker.string.hexadecimal({ length: 64, casing: "lower" }).slice(2)
}

// Generate ETH value in wei
export function mockEthValue(): string {
  return faker.number.bigInt({ min: 1000000000000000n, max: 100000000000000000000n }).toString()
}

// Generate ISO timestamp within last year
export function mockTimestamp(): string {
  return faker.date.recent({ days: 365 }).toISOString()
}

// Risk level generator
export function mockRiskLevel(): "low" | "medium" | "high" | "critical" {
  return faker.helpers.arrayElement(["low", "medium", "high", "critical"])
}

// Risk score (0-1)
export function mockRiskScore(): number {
  return faker.number.float({ min: 0, max: 1, fractionDigits: 2 })
}

// Common risk tags
const RISK_TAGS = ["mixer", "exchange", "gambling", "scam", "darknet", "sanctioned", "high-volume", "smart-contract", "dex", "defi"]

export function mockTags(count: number = 3): string[] {
  return faker.helpers.arrayElements(RISK_TAGS, { min: 0, max: count })
}

// Risk factor
export function mockRiskFactor() {
  return {
    name: faker.helpers.arrayElement(["High Transaction Volume", "Mixer Interaction", "Sanctioned Entity", "New Address", "Unusual Pattern"]),
    score: mockRiskScore(),
    weight: faker.number.float({ min: 0.1, max: 0.5, fractionDigits: 2 }),
    description: faker.lorem.sentence(),
    triggered: faker.datatype.boolean(),
  }
}

// Address info for basic analysis
export function mockAddressInfo(address?: string) {
  const addr = address || mockAddress()
  return {
    address: addr,
    network: "ethereum",
    firstSeen: mockTimestamp(),
    lastSeen: mockTimestamp(),
    totalTxCount: faker.number.int({ min: 10, max: 10000 }),
    sentTxCount: faker.number.int({ min: 5, max: 5000 }),
    receivedTxCount: faker.number.int({ min: 5, max: 5000 }),
    uniqueInteracted: faker.number.int({ min: 5, max: 500 }),
  }
}

// Risk score response
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

// Graph address info
export function mockGraphAddressInfo(address?: string) {
  const addr = address || mockAddress()
  return {
    address: addr,
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

// Neighbor info
export function mockNeighborInfo() {
  return {
    address: mockAddress(),
    direction: faker.helpers.arrayElement(["incoming", "outgoing", "both"] as const),
    transferCount: faker.number.int({ min: 1, max: 100 }),
    totalValue: mockEthValue(),
    lastTransfer: mockTimestamp(),
    riskScore: mockRiskScore(),
    tags: mockTags(3),
  }
}

// Cluster response
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

// Transfer
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

// Path node
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

// Full address analysis response
export function mockAddressAnalysisResponse(address?: string) {
  const addr = address || mockAddress()
  return {
    address: addr,
    network: "ethereum",
    basic: {
      addressInfo: mockAddressInfo(addr),
      riskScore: mockRiskScoreResponse(addr),
    },
    graph: {
      graphInfo: mockGraphAddressInfo(addr),
      neighbors: {
        address: addr,
        neighbors: Array.from({ length: faker.number.int({ min: 3, max: 10 }) }, mockNeighborInfo),
        totalCount: faker.number.int({ min: 10, max: 100 }),
        depth: 1,
      },
      tags: mockTags(5),
      cluster: mockClusterResponse(),
    },
    orchestratedAt: Date.now(),
  }
}

// High risk network response
export function mockHighRiskNetworkResponse() {
  return {
    threshold: 0.7,
    count: faker.number.int({ min: 5, max: 20 }),
    highRiskAddresses: Array.from({ length: faker.number.int({ min: 5, max: 15 }) }, () => ({
      address: mockAddress(),
      firstSeen: mockTimestamp(),
      lastSeen: mockTimestamp(),
      txCount: faker.number.int({ min: 100, max: 10000 }),
      riskScore: faker.number.float({ min: 0.7, max: 1, fractionDigits: 2 }),
      tags: mockTags(4),
      clusterId: faker.string.uuid(),
      network: "ethereum",
      incomingCount: faker.number.int({ min: 50, max: 5000 }),
      outgoingCount: faker.number.int({ min: 50, max: 5000 }),
    })),
    orchestratedAt: Date.now(),
  }
}

// Connection response
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

// Neighbors response
export function mockNeighborsResponse(address?: string) {
  const addr = address || mockAddress()
  return {
    address: addr,
    neighbors: Array.from({ length: faker.number.int({ min: 5, max: 15 }) }, mockNeighborInfo),
    totalCount: faker.number.int({ min: 20, max: 100 }),
    depth: 1,
  }
}

// Pipeline status
export function mockPipelineStatus() {
  return {
    ingestion: {
      status: faker.helpers.arrayElement(["RUNNING", "IDLE", "PAUSED"]),
      lastProcessedBlock: faker.number.int({ min: 18000000, max: 19000000 }),
      blocksPerMinute: faker.number.float({ min: 10, max: 60, fractionDigits: 1 }),
      lastUpdateTime: mockTimestamp(),
    },
    graphSync: {
      status: faker.helpers.arrayElement(["RUNNING", "IDLE", "PAUSED"]),
      syncedAddresses: faker.number.int({ min: 100000, max: 1000000 }),
      syncedTransfers: faker.number.int({ min: 500000, max: 5000000 }),
      lastSyncTime: mockTimestamp(),
    },
    streamProcessor: {
      status: faker.helpers.arrayElement(["RUNNING", "IDLE", "ERROR"]),
      messagesPerSecond: faker.number.float({ min: 100, max: 1000, fractionDigits: 0 }),
      lag: faker.number.int({ min: 0, max: 1000 }),
    },
  }
}

// Services list
export function mockServices() {
  const services = ["address-service", "risk-service", "graph-service", "transfer-service", "orchestrator"]
  return services.map(name => ({
    name,
    status: faker.helpers.arrayElement(["UP", "UP", "UP", "DOWN"]),
    instances: faker.number.int({ min: 1, max: 3 }),
    version: `1.${faker.number.int({ min: 0, max: 5 })}.${faker.number.int({ min: 0, max: 20 })}`,
    lastHeartbeat: mockTimestamp(),
  }))
}

// Risk config
export function mockRiskConfig() {
  return {
    defaultThreshold: 0.7,
    rules: [
      { name: "mixer_interaction", weight: 0.3, enabled: true },
      { name: "sanctioned_entity", weight: 0.5, enabled: true },
      { name: "high_volume", weight: 0.2, enabled: true },
      { name: "new_address", weight: 0.1, enabled: false },
    ],
    cacheEnabled: true,
    cacheTtlSeconds: 3600,
  }
}

// Pipeline config
export function mockPipelineConfig() {
  return {
    ingestion: {
      batchSize: 100,
      pollIntervalMs: 1000,
      enabled: true,
    },
    graphSync: {
      syncIntervalMs: 60000,
      batchSize: 500,
      enabled: true,
    },
    clustering: {
      algorithm: "common-input",
      minClusterSize: 2,
      enabled: true,
    },
  }
}
