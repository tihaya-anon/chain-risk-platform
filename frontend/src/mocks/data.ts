/**
 * Mock data generators
 * Centralized mock data generation functions
 */

import type {
  LoginResponse,
  User,
  AddressInfo,
  AddressStats,
  Transfer,
  PaginatedResponse,
  RiskScore,
  BatchRiskScoreResponse,
  RiskRule,
  GraphAddressInfo,
  NeighborInfo,
  AddressNeighborsResponse,
  PathNode,
  PathResponse,
  ClusterResponse,
  SyncStatusResponse,
  PropagationResultResponse,
  ClusteringResultResponse,
  AddressAnalysis,
  ConnectionResponse,
  HighRiskNetworkResponse,
  ServiceInfo,
  PipelineStatus,
  RiskProperties,
  PipelineProperties,
} from "@/types"

// ============ Helpers ============

export const randomAddress = (): string =>
  "0x" +
  Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")

export const randomTxHash = (): string =>
  "0x" +
  Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")

export const randomAmount = (min = 0.01, max = 100): string =>
  (Math.random() * (max - min) + min).toFixed(6)

export const randomDate = (daysAgo = 30): string => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date.toISOString()
}

export const randomRiskScore = (): number => Math.random()

export const randomTags = (): string[] => {
  const allTags = [
    "exchange",
    "defi",
    "mixer",
    "scam",
    "whale",
    "miner",
    "contract",
    "nft",
    "dao",
    "bridge",
  ]
  const count = Math.floor(Math.random() * 7)
  return allTags.sort(() => Math.random() - 0.5).slice(0, count)
}

// ============ Auth Data Generators ============

export const generateJWT = (username: string, role: string): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = btoa(
    JSON.stringify({
      sub: username === "admin" ? "1" : "2",
      username,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  )
  const signature = btoa("mock-signature")
  return `${header}.${payload}.${signature}`
}

export const generateLoginResponse = (username: string, role: string): LoginResponse => ({
  accessToken: generateJWT(username, role),
  tokenType: "Bearer",
  expiresIn: "1d",
})

export const generateUser = (username: string, role: string): User => ({
  sub: username === "admin" ? "1" : "2",
  username,
  role,
})

// ============ Address Data Generators ============

export const generateAddressInfo = (address: string): AddressInfo => ({
  address,
  network: "ethereum",
  firstSeen: randomDate(365),
  lastSeen: randomDate(7),
  totalTxCount: Math.floor(Math.random() * 1000) + 10,
  sentTxCount: Math.floor(Math.random() * 500) + 5,
  receivedTxCount: Math.floor(Math.random() * 500) + 5,
  uniqueInteracted: Math.floor(Math.random() * 200) + 10,
})

export const generateTransfer = (address: string, index: number): Transfer => {
  const isIncoming = Math.random() > 0.5
  return {
    id: index,
    txHash: randomTxHash(),
    blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
    fromAddress: isIncoming ? randomAddress() : address,
    toAddress: isIncoming ? address : randomAddress(),
    value: randomAmount(0.01, 50),
    timestamp: randomDate(30),
    transferType: Math.random() > 0.7 ? "token" : "native",
    network: "ethereum",
  }
}

export const generateTransfers = (
  address: string,
  count = 20
): PaginatedResponse<Transfer> => ({
  items: Array.from({ length: count }, (_, i) => generateTransfer(address, i)),
  pagination: {
    page: 1,
    pageSize: count,
    total: Math.floor(Math.random() * 1000) + count,
    totalPages: Math.floor(Math.random() * 50) + 1,
  },
})

export const generateAddressStats = (): AddressStats => ({
  totalValueSent: randomAmount(10, 10000),
  totalValueReceived: randomAmount(10, 10000),
  avgTxValue: randomAmount(0.1, 100),
  maxTxValue: randomAmount(100, 1000),
  minTxValue: randomAmount(0.001, 0.1),
})

// ============ Risk Data Generators ============

const riskLevels = ["low", "medium", "high", "critical"] as const

export const generateRiskScore = (address: string): RiskScore => {
  const score = Math.random()
  const levelIndex = Math.min(Math.floor(score * 4), 3)

  return {
    address,
    network: "ethereum",
    riskScore: parseFloat(score.toFixed(2)),
    riskLevel: riskLevels[levelIndex],
    factors: [
      {
        name: "blacklist_check",
        score: Math.random() > 0.8 ? 0.8 : 0,
        weight: 2.0,
        description: "Address found in blacklist",
        triggered: Math.random() > 0.8,
      },
      {
        name: "high_frequency",
        score: parseFloat((Math.random() * 0.5).toFixed(2)),
        weight: 1.0,
        description: "High transaction frequency detected",
        triggered: Math.random() > 0.5,
      },
      {
        name: "large_transaction",
        score: parseFloat((Math.random() * 0.4).toFixed(2)),
        weight: 1.2,
        description: "Large value transactions",
        triggered: Math.random() > 0.6,
      },
      {
        name: "new_address",
        score: parseFloat((Math.random() * 0.3).toFixed(2)),
        weight: 0.8,
        description: "Recently created address",
        triggered: Math.random() > 0.7,
      },
      {
        name: "round_amounts",
        score: parseFloat((Math.random() * 0.2).toFixed(2)),
        weight: 0.6,
        description: "Suspicious round amount patterns",
        triggered: Math.random() > 0.6,
      },
    ],
    tags: randomTags(),
    evaluatedAt: new Date().toISOString(),
    cached: false,
  }
}

export const generateBatchRiskScores = (addresses: string[]): BatchRiskScoreResponse => ({
  results: addresses.map(generateRiskScore),
  total: addresses.length,
  failed: 0,
})

// ============ Risk Rules Data ============

export const riskRules: RiskRule[] = [
  {
    name: "blacklist_check",
    description: "Check if address is in known blacklists",
    weight: 2.0,
    enabled: true,
  },
  {
    name: "high_frequency",
    description: "Detect high transaction frequency patterns",
    weight: 1.0,
    enabled: true,
  },
  {
    name: "large_transaction",
    description: "Flag large value transactions",
    weight: 1.2,
    enabled: true,
  },
  {
    name: "new_address",
    description: "Identify recently created addresses",
    weight: 0.8,
    enabled: true,
  },
  {
    name: "round_amounts",
    description: "Detect suspicious round amount patterns",
    weight: 0.6,
    enabled: false,
  },
]

// ============ Graph Data Generators ============

export const generateGraphAddressInfo = (address: string): GraphAddressInfo => ({
  address,
  firstSeen: randomDate(365),
  lastSeen: randomDate(7),
  txCount: Math.floor(Math.random() * 1000) + 10,
  riskScore: parseFloat(randomRiskScore().toFixed(2)),
  tags: randomTags(),
  clusterId:
    Math.random() > 0.5 ? `cluster-${Math.floor(Math.random() * 100)}` : undefined,
  network: "ethereum",
  incomingCount: Math.floor(Math.random() * 500) + 5,
  outgoingCount: Math.floor(Math.random() * 500) + 5,
})

export const generateNeighborInfo = (): NeighborInfo => {
  const directions = ["incoming", "outgoing", "both"] as const
  return {
    address: randomAddress(),
    direction: directions[Math.floor(Math.random() * 3)],
    transferCount: Math.floor(Math.random() * 50) + 1,
    totalValue: (Math.random() * 1000).toFixed(4),
    lastTransfer: randomDate(30),
    riskScore: parseFloat(randomRiskScore().toFixed(2)),
    tags: randomTags(),
  }
}

export const generateNeighborsResponse = (
  address: string,
  depth: number,
  limit: number
): AddressNeighborsResponse => ({
  address,
  neighbors: Array.from(
    { length: Math.min(limit, 20 + Math.floor(Math.random() * 30)) },
    generateNeighborInfo
  ),
  totalCount: Math.floor(Math.random() * 200) + limit,
  depth,
})

export const generatePathNode = (address: string): PathNode => ({
  address,
  txHash: randomTxHash(),
  value: (Math.random() * 100).toFixed(4),
  timestamp: randomDate(30),
  riskScore: parseFloat(randomRiskScore().toFixed(2)),
  tags: randomTags(),
})

export const generatePathResponse = (
  fromAddress: string,
  toAddress: string,
  maxDepth: number
): PathResponse => {
  const found = Math.random() > 0.3 // 70% chance of finding a path
  const pathLength = found ? Math.floor(Math.random() * Math.min(maxDepth, 5)) + 2 : 0

  const path: PathNode[] = found
    ? [
        generatePathNode(fromAddress),
        ...Array.from({ length: pathLength - 2 }, () =>
          generatePathNode(randomAddress())
        ),
        generatePathNode(toAddress),
      ]
    : []

  return {
    found,
    fromAddress,
    toAddress,
    pathLength: found ? pathLength : 0,
    maxDepth,
    message: found
      ? `Found path with ${pathLength} hops`
      : "No path found within max depth",
    path,
  }
}

export const generateClusterResponse = (clusterId?: string): ClusterResponse => ({
  clusterId: clusterId || `cluster-${Math.floor(Math.random() * 1000)}`,
  size: Math.floor(Math.random() * 50) + 2,
  riskScore: parseFloat(randomRiskScore().toFixed(2)),
  label:
    Math.random() > 0.5
      ? ["Exchange", "DeFi Protocol", "Mining Pool", "Unknown Entity"][
          Math.floor(Math.random() * 4)
        ]
      : undefined,
  category:
    Math.random() > 0.5
      ? ["exchange", "defi", "mixer", "unknown"][Math.floor(Math.random() * 4)]
      : undefined,
  tags: randomTags(),
  addresses: Array.from({ length: Math.floor(Math.random() * 10) + 2 }, randomAddress),
  createdAt: randomDate(180),
  updatedAt: randomDate(7),
  network: "ethereum",
})

export const generateSyncStatus = (): SyncStatusResponse => ({
  status: ["synced", "syncing", "error"][Math.floor(Math.random() * 3)],
  lastSyncedBlock: Math.floor(Math.random() * 1000000) + 18000000,
  totalAddresses: Math.floor(Math.random() * 100000) + 10000,
  totalTransfers: Math.floor(Math.random() * 1000000) + 100000,
  lastSyncTime: randomDate(1),
  nextSyncTime: new Date(Date.now() + 300000).toISOString(),
  network: "ethereum",
  errorMessage: undefined,
})

export const generatePropagationResult = (): PropagationResultResponse => ({
  status: "completed",
  addressesAffected: Math.floor(Math.random() * 1000) + 100,
  tagsPropagated: Math.floor(Math.random() * 500) + 50,
  maxHops: 3,
  decayFactor: 0.5,
  durationMs: Math.floor(Math.random() * 5000) + 1000,
  startedAt: randomDate(1),
  completedAt: new Date().toISOString(),
  errorMessage: undefined,
})

export const generateClusteringResult = (): ClusteringResultResponse => ({
  status: "completed",
  clustersCreated: Math.floor(Math.random() * 100) + 10,
  addressesClustered: Math.floor(Math.random() * 1000) + 100,
  durationMs: Math.floor(Math.random() * 10000) + 2000,
  startedAt: randomDate(1),
  completedAt: new Date().toISOString(),
  errorMessage: undefined,
})

export const generateHighRiskAddresses = (
  threshold: number,
  limit: number
): GraphAddressInfo[] => {
  return Array.from({ length: limit }, () => {
    const info = generateGraphAddressInfo(randomAddress())
    // Ensure risk score is above threshold
    info.riskScore = parseFloat((threshold + Math.random() * (1 - threshold)).toFixed(2))
    // High risk addresses more likely to have tags
    info.tags = ["mixer", "scam", "blacklist", "suspicious"].slice(
      0,
      Math.floor(Math.random() * 3) + 1
    )
    return info
  })
}

// ============ Orchestration Data Generators ============

export const generateAddressAnalysis = (address: string): AddressAnalysis => ({
  address,
  network: "ethereum",
  basic: {
    addressInfo: generateAddressInfo(address),
    riskScore: generateRiskScore(address),
  },
  graph: {
    graphInfo: generateGraphAddressInfo(address),
    neighbors: generateNeighborsResponse(address, 1, 10),
    tags: randomTags(),
    cluster:
      Math.random() > 0.4 ? generateClusterResponse() : { error: "Not in any cluster" },
  },
  orchestratedAt: Date.now(),
})

export const generateConnectionResponse = (
  fromAddress: string,
  toAddress: string,
  maxDepth: number
): ConnectionResponse => ({
  fromAddress,
  toAddress,
  path: generatePathResponse(fromAddress, toAddress, maxDepth),
  fromAddressRisk: generateRiskScore(fromAddress),
  toAddressRisk: generateRiskScore(toAddress),
  orchestratedAt: Date.now(),
})

export const generateHighRiskNetworkResponse = (
  threshold: number,
  limit: number
): HighRiskNetworkResponse => ({
  threshold,
  count: limit,
  highRiskAddresses: generateHighRiskAddresses(threshold, limit),
  orchestratedAt: Date.now(),
})

// ============ Admin Data Generators ============

export const generateServiceInfo = (name: string): ServiceInfo => {
  const instanceCount = Math.floor(Math.random() * 5) + 1
  const healthyInstanceCount = Math.floor(Math.random() * instanceCount) + 1

  return {
    name,
    groupName: "DEFAULT_GROUP",
    clusterCount: 1,
    instanceCount,
    healthyInstanceCount,
  }
}

export const generateServicesInfo = (): ServiceInfo[] => [
  generateServiceInfo("bff-service"),
  generateServiceInfo("orchestrator-service"),
  generateServiceInfo("graph-engine-service"),
  generateServiceInfo("query-service"),
  generateServiceInfo("risk-ml-service"),
  generateServiceInfo("data-ingestion-service"),
]

export const generatePipelineStatus = (): PipelineStatus => {
  const ingestionStatus = ["IDLE", "RUNNING", "FAILED"][Math.floor(Math.random() * 3)]
  const graphSyncStatus = ["IDLE", "RUNNING", "COMPLETED"][Math.floor(Math.random() * 3)]

  return {
    ingestion: {
      enabled: true,
      status: ingestionStatus,
      lastBlock: Math.floor(Math.random() * 1000000) + 18000000,
      errorMessage: ingestionStatus === "FAILED" ? "Connection timeout" : undefined,
    },
    streamProcessor: {
      enabled: true,
      status: "RUNNING",
      processedCount: Math.floor(Math.random() * 1000000) + 100000,
    },
    graphSync: {
      enabled: true,
      status: graphSyncStatus,
      lastSyncTime: randomDate(1),
    },
    clustering: {
      enabled: true,
      lastRunTime: randomDate(7),
    },
    propagation: {
      enabled: true,
      lastRunTime: randomDate(7),
    },
  }
}

export const generateRiskConfig = (): RiskProperties => ({
  highThreshold: 0.7,
  mediumThreshold: 0.4,
  cacheTtlSeconds: 3600,
})

export const generatePipelineConfig = (): PipelineProperties => ({
  enabled: true,
  ingestion: {
    enabled: true,
    network: "ethereum",
    polling: {
      intervalMs: 5000,
      batchSize: 100,
      confirmations: 12,
    },
    rateLimit: {
      requestsPerSecond: 10,
    },
  },
  streamProcessor: {
    enabled: true,
    parallelism: 4,
    checkpoint: {
      intervalMs: 60000,
    },
    consumer: {
      maxPollRecords: 500,
    },
  },
  graphSync: {
    enabled: true,
    intervalMs: 300000,
    batchSize: 1000,
  },
  clustering: {
    enabled: true,
    minClusterSize: 3,
    maxDepth: 3,
  },
  propagation: {
    enabled: true,
    maxHops: 3,
    decayFactor: 0.8,
    minThreshold: 0.1,
  },
})
