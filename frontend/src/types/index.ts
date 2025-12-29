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
