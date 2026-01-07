/**
 * Service Mock Fixtures
 *
 * Pre-generated mock data based on OpenAPI schemas for consistent testing.
 */

// ============== Query Service Fixtures ==============

export const mockAddressInfo = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  network: "ethereum",
  firstSeen: "2023-01-15T10:30:00Z",
  lastSeen: "2024-01-10T14:20:00Z",
  sentTxCount: 150,
  receivedTxCount: 200,
  totalTxCount: 350,
  uniqueInteracted: 85,
};

export const mockAddressStats = {
  totalValueSent: "1250.5",
  totalValueReceived: "1850.75",
  avgTxValue: "8.86",
  maxTxValue: "500.0",
  minTxValue: "0.001",
};

export const mockTransfer = {
  id: 12345,
  txHash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abcd",
  fromAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  toAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  value: "1.5",
  tokenAddress: null,
  tokenSymbol: "ETH",
  tokenDecimal: 18,
  transferType: "native",
  network: "ethereum",
  blockNumber: 18500000,
  logIndex: 0,
  timestamp: "2024-01-10T14:20:00Z",
};

export const mockTransferList = {
  items: [mockTransfer],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 150,
    totalPages: 8,
  },
};

export const mockQueryServiceResponse = <T>(data: T, meta?: object) => ({
  success: true,
  data,
  meta,
  error: null,
});

export const mockQueryServiceError = (message: string, code = "ERROR") => ({
  success: false,
  data: null,
  error: { message, code },
});

// ============== Risk Service Fixtures ==============

export const mockRiskFactor = {
  name: "high_tx_frequency",
  score: 0.7,
  weight: 1.5,
  description: "High transaction frequency detected",
  triggered: true,
};

export const mockRiskScore = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  network: "ethereum",
  risk_score: 0.65,
  risk_level: "medium",
  factors: [mockRiskFactor],
  tags: ["high_activity", "defi_user"],
  evaluated_at: "2024-01-10T15:00:00Z",
  cached: false,
};

export const mockBatchRiskScore = {
  results: [mockRiskScore],
  total: 1,
  failed: 0,
};

export const mockRiskRules = [
  {
    name: "HighTxFrequencyRule",
    description: "Detects high transaction frequency",
    weight: 1.5,
    enabled: true,
  },
  {
    name: "LargeValueRule",
    description: "Detects large value transfers",
    weight: 2.0,
    enabled: true,
  },
];

// ============== Graph Service Fixtures ==============

export const mockGraphAddressInfo = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  firstSeen: "2023-01-15T10:30:00Z",
  lastSeen: "2024-01-10T14:20:00Z",
  txCount: 350,
  riskScore: 0.65,
  tags: ["exchange", "high_volume"],
  clusterId: "cluster_001",
  network: "ethereum",
  incomingCount: 200,
  outgoingCount: 150,
};

export const mockNeighborInfo = {
  address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  direction: "outgoing",
  transferCount: 25,
  totalValue: "150.5",
  lastTransfer: "2024-01-10T14:20:00Z",
  riskScore: 0.3,
  tags: ["defi"],
};

export const mockAddressNeighbors = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  neighbors: [mockNeighborInfo],
  totalCount: 85,
  depth: 1,
};

export const mockPathNode = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  txHash: "0xabc123",
  value: "1.5",
  timestamp: "2024-01-10T14:20:00Z",
  riskScore: 0.65,
  tags: ["exchange"],
};

export const mockPathResponse = {
  found: true,
  fromAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  toAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  pathLength: 2,
  maxDepth: 5,
  message: "Path found",
  path: [mockPathNode],
};

export const mockCluster = {
  clusterId: "cluster_001",
  size: 15,
  riskScore: 0.55,
  label: "Exchange Cluster",
  category: "exchange",
  tags: ["high_volume", "verified"],
  addresses: ["0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00"],
  createdAt: "2023-06-01T00:00:00Z",
  updatedAt: "2024-01-10T00:00:00Z",
  network: "ethereum",
};

export const mockPropagationResult = {
  status: "completed",
  addressesAffected: 150,
  tagsPropagated: 45,
  maxHops: 3,
  decayFactor: 0.5,
  durationMs: 2500,
  startedAt: "2024-01-10T15:00:00Z",
  completedAt: "2024-01-10T15:00:02.5Z",
  errorMessage: null,
};

export const mockClusteringResult = {
  status: "completed",
  clustersCreated: 25,
  addressesClustered: 500,
  durationMs: 5000,
  startedAt: "2024-01-10T15:00:00Z",
  completedAt: "2024-01-10T15:00:05Z",
  errorMessage: null,
};

// ============== Factory Functions ==============

export function createMockAddress(overrides: Partial<typeof mockAddressInfo> = {}) {
  return { ...mockAddressInfo, ...overrides };
}

export function createMockRiskScore(overrides: Partial<typeof mockRiskScore> = {}) {
  return { ...mockRiskScore, ...overrides };
}

export function createMockTransfer(overrides: Partial<typeof mockTransfer> = {}) {
  return { ...mockTransfer, ...overrides };
}

export function createMockCluster(overrides: Partial<typeof mockCluster> = {}) {
  return { ...mockCluster, ...overrides };
}
