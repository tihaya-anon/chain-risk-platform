// Auth types
export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresIn: string
}

export interface User {
  sub: string
  username: string
  role: string
}

// Address types
export interface AddressInfo {
  address: string
  network: string
  firstSeen: string
  lastSeen: string
  totalTxCount: number
  sentTxCount: number
  receivedTxCount: number
  uniqueInteracted: number
}

export interface Transfer {
  id: number
  txHash: string
  blockNumber: number
  fromAddress: string
  toAddress: string
  value: string
  timestamp: string
  transferType: string
  network: string
}

export interface AddressStats {
  totalValueSent: string
  totalValueReceived: string
  avgTxValue: string
  maxTxValue: string
  minTxValue: string
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// Risk types
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface RiskFactor {
  name: string
  score: number
  weight: number
  description: string
  triggered: boolean
}

export interface RiskScore {
  address: string
  network: string
  riskScore: number
  riskLevel: RiskLevel
  factors: RiskFactor[]
  tags: string[]
  evaluatedAt: string
  cached: boolean
}

export interface RiskScoreRequest {
  address: string
  network?: string
  includeFactors?: boolean
}

export interface BatchRiskScoreRequest {
  addresses: string[]
  network?: string
  includeFactors?: boolean
}

export interface BatchRiskScoreResponse {
  results: RiskScore[]
  total: number
  failed: number
}

export interface RiskRule {
  name: string
  description: string
  weight: number
  enabled: boolean
}

// ==================== Graph Types ====================

// Graph Address Info (from graph-engine)
export interface GraphAddressInfo {
  address: string
  firstSeen: string
  lastSeen: string
  txCount: number
  riskScore: number
  tags: string[]
  clusterId?: string
  network: string
  incomingCount: number
  outgoingCount: number
}

// Neighbor Info
export interface NeighborInfo {
  address: string
  direction: 'incoming' | 'outgoing' | 'both'
  transferCount: number
  totalValue: string
  lastTransfer: string
  riskScore: number
  tags: string[]
}

// Address Neighbors Response
export interface AddressNeighborsResponse {
  address: string
  neighbors: NeighborInfo[]
  totalCount: number
  depth: number
}

// Path Node
export interface PathNode {
  address: string
  txHash?: string
  value?: string
  timestamp?: string
  riskScore: number
  tags: string[]
}

// Path Response
export interface PathResponse {
  found: boolean
  fromAddress: string
  toAddress: string
  pathLength: number
  maxDepth: number
  message?: string
  path: PathNode[]
}

// Cluster Response
export interface ClusterResponse {
  clusterId: string
  size: number
  riskScore: number
  label?: string
  category?: string
  tags: string[]
  addresses: string[]
  createdAt: string
  updatedAt: string
  network: string
}

// Add Tag Request
export interface AddTagRequest {
  tags: string[]
  source?: string
  confidence?: number
}

// Sync Status Response
export interface SyncStatusResponse {
  status: string
  lastSyncedBlock: number
  totalAddresses: number
  totalTransfers: number
  lastSyncTime: string
  nextSyncTime?: string
  network: string
  errorMessage?: string
}

// Propagation Result Response
export interface PropagationResultResponse {
  status: string
  addressesAffected: number
  tagsPropagated: number
  maxHops: number
  decayFactor: number
  durationMs: number
  startedAt: string
  completedAt: string
  errorMessage?: string
}

// Clustering Result Response
export interface ClusteringResultResponse {
  status: string
  clustersCreated: number
  addressesClustered: number
  durationMs: number
  startedAt: string
  completedAt: string
  errorMessage?: string
}

// ==================== Orchestration Types ====================

// Address Profile (basic orchestration)
export interface AddressProfile {
  address: string
  network: string
  addressInfo: AddressInfo | { error: string }
  riskScore: RiskScore | { error: string }
  recentTransfers: PaginatedResponse<Transfer> | { error: string }
  orchestratedAt: number
}

// Address Analysis (comprehensive orchestration with graph)
export interface AddressAnalysis {
  address: string
  network: string
  basic: {
    addressInfo: AddressInfo | { error: string }
    riskScore: RiskScore | { error: string }
  }
  graph: {
    graphInfo: GraphAddressInfo | { error: string }
    neighbors: AddressNeighborsResponse | { error: string }
    tags: string[]
    cluster: ClusterResponse | { error: string }
  }
  orchestratedAt: number
}

// Connection Response
export interface ConnectionResponse {
  fromAddress: string
  toAddress: string
  path: PathResponse
  fromAddressRisk: RiskScore | { error: string }
  toAddressRisk: RiskScore | { error: string }
  orchestratedAt: number
}

// High Risk Network Response
export interface HighRiskNetworkResponse {
  threshold: number
  count: number
  highRiskAddresses: GraphAddressInfo[]
  orchestratedAt: number
}
