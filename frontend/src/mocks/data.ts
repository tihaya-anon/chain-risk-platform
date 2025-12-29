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
} from '@/types'

// ============ Helpers ============

export const randomAddress = (): string =>
  '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

export const randomTxHash = (): string =>
  '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

export const randomAmount = (min = 0.01, max = 100): string =>
  (Math.random() * (max - min) + min).toFixed(6)

export const randomDate = (daysAgo = 30): string => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date.toISOString()
}

// ============ Auth Data Generators ============

export const generateJWT = (username: string, role: string): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub: username === 'admin' ? '1' : '2',
      username,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  )
  const signature = btoa('mock-signature')
  return `${header}.${payload}.${signature}`
}

export const generateLoginResponse = (username: string, role: string): LoginResponse => ({
  accessToken: generateJWT(username, role),
  tokenType: 'Bearer',
  expiresIn: '1d',
})

export const generateUser = (username: string, role: string): User => ({
  sub: username === 'admin' ? '1' : '2',
  username,
  role,
})

// ============ Address Data Generators ============

export const generateAddressInfo = (address: string): AddressInfo => ({
  address,
  network: 'ethereum',
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
    transferType: Math.random() > 0.7 ? 'token' : 'native',
    network: 'ethereum',
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

const riskLevels = ['low', 'medium', 'high', 'critical'] as const

export const generateRiskScore = (address: string): RiskScore => {
  const score = Math.random() * 100
  const levelIndex = Math.min(Math.floor(score / 25), 3)

  return {
    address,
    network: 'ethereum',
    riskScore: Math.floor(score),
    riskLevel: riskLevels[levelIndex],
    factors: [
      {
        name: 'blacklist_check',
        score: Math.random() > 0.8 ? 50 : 0,
        weight: 2.0,
        description: 'Address found in blacklist',
        triggered: Math.random() > 0.8,
      },
      {
        name: 'high_frequency',
        score: Math.floor(Math.random() * 30),
        weight: 1.0,
        description: 'High transaction frequency detected',
        triggered: Math.random() > 0.5,
      },
      {
        name: 'large_transaction',
        score: Math.floor(Math.random() * 25),
        weight: 1.2,
        description: 'Large value transactions',
        triggered: Math.random() > 0.6,
      },
      {
        name: 'new_address',
        score: Math.floor(Math.random() * 15),
        weight: 0.8,
        description: 'Recently created address',
        triggered: Math.random() > 0.7,
      },
      {
        name: 'round_amounts',
        score: Math.floor(Math.random() * 10),
        weight: 0.6,
        description: 'Suspicious round amount patterns',
        triggered: Math.random() > 0.6,
      },
    ],
    tags: Math.random() > 0.5 ? ['exchange', 'high-volume'] : ['defi', 'active'],
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
    name: 'blacklist_check',
    description: 'Check if address is in known blacklists',
    weight: 2.0,
    enabled: true,
  },
  {
    name: 'high_frequency',
    description: 'Detect high transaction frequency patterns',
    weight: 1.0,
    enabled: true,
  },
  {
    name: 'large_transaction',
    description: 'Flag large value transactions',
    weight: 1.2,
    enabled: true,
  },
  {
    name: 'new_address',
    description: 'Identify recently created addresses',
    weight: 0.8,
    enabled: true,
  },
  {
    name: 'round_amounts',
    description: 'Detect suspicious round amount patterns',
    weight: 0.6,
    enabled: false,
  },
]
