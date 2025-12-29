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

// Helper to generate random address
const randomAddress = () =>
  '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

// Helper to generate random tx hash
const randomTxHash = () =>
  '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

// Mock delay to simulate network
export const mockDelay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

// Auth mocks
export const mockLogin = async (): Promise<LoginResponse> => {
  await mockDelay(300)
  // Generate a fake JWT token
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub: '1',
      username: 'admin',
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 86400000,
    })
  )
  const signature = btoa('mock-signature')
  return {
    accessToken: `${header}.${payload}.${signature}`,
    tokenType: 'Bearer',
    expiresIn: '1d',
  }
}

export const mockGetProfile = async (): Promise<User> => {
  await mockDelay(200)
  return {
    sub: '1',
    username: 'admin',
    role: 'admin',
  }
}

// Address mocks
export const mockGetAddressInfo = async (address: string): Promise<AddressInfo> => {
  await mockDelay(400)
  return {
    address,
    network: 'ethereum',
    firstSeen: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    totalTxCount: Math.floor(Math.random() * 1000) + 50,
    sentTxCount: Math.floor(Math.random() * 500) + 20,
    receivedTxCount: Math.floor(Math.random() * 500) + 30,
    uniqueInteracted: Math.floor(Math.random() * 200) + 10,
  }
}

export const mockGetAddressTransfers = async (
  address: string
): Promise<PaginatedResponse<Transfer>> => {
  await mockDelay(500)
  const transfers: Transfer[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    txHash: randomTxHash(),
    blockNumber: 18000000 + Math.floor(Math.random() * 100000),
    fromAddress: i % 2 === 0 ? address : randomAddress(),
    toAddress: i % 2 === 0 ? randomAddress() : address,
    value: (Math.random() * 10).toFixed(18) + '000000000000000000',
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    transferType: i % 3 === 0 ? 'contract' : 'transfer',
    network: 'ethereum',
  }))

  return {
    items: transfers,
    pagination: {
      page: 1,
      pageSize: 10,
      total: 100,
      totalPages: 10,
    },
  }
}

export const mockGetAddressStats = async (): Promise<AddressStats> => {
  await mockDelay(300)
  return {
    totalValueSent: (Math.random() * 100).toFixed(18) + '000000000000000000',
    totalValueReceived: (Math.random() * 150).toFixed(18) + '000000000000000000',
    avgTxValue: (Math.random() * 5).toFixed(18) + '000000000000000000',
    maxTxValue: (Math.random() * 50).toFixed(18) + '000000000000000000',
    minTxValue: (Math.random() * 0.1).toFixed(18) + '000000000000000000',
  }
}

// Risk mocks
const riskLevels = ['low', 'medium', 'high', 'critical'] as const

export const mockScoreAddress = async (address: string): Promise<RiskScore> => {
  await mockDelay(600)
  const score = Math.random() * 100
  const levelIndex =
    score < 25 ? 0 : score < 50 ? 1 : score < 75 ? 2 : 3

  return {
    address,
    network: 'ethereum',
    riskScore: score,
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
        score: Math.random() * 30,
        weight: 1.0,
        description: 'High transaction frequency detected',
        triggered: Math.random() > 0.5,
      },
      {
        name: 'large_transaction',
        score: Math.random() * 25,
        weight: 1.2,
        description: 'Large value transactions',
        triggered: Math.random() > 0.6,
      },
      {
        name: 'new_address',
        score: Math.random() * 15,
        weight: 0.8,
        description: 'Recently created address',
        triggered: Math.random() > 0.7,
      },
      {
        name: 'round_amounts',
        score: Math.random() * 10,
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

export const mockScoreAddressesBatch = async (
  addresses: string[]
): Promise<BatchRiskScoreResponse> => {
  await mockDelay(800)
  const results = await Promise.all(addresses.map((addr) => mockScoreAddress(addr)))
  return {
    results,
    total: addresses.length,
    failed: 0,
  }
}

export const mockListRules = async (): Promise<RiskRule[]> => {
  await mockDelay(200)
  return [
    {
      name: 'blacklist_check',
      description: 'Check if address is in known blacklists',
      weight: 2.0,
      enabled: true,
    },
    {
      name: 'high_frequency',
      description: 'Detect high transaction frequency',
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
      enabled: true,
    },
  ]
}
