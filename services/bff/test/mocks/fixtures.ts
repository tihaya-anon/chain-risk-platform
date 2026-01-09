/**
 * Service Mock Fixtures
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

export const createMockAddress = (overrides: Partial<typeof mockAddressInfo> = {}) => ({
  ...mockAddressInfo,
  ...overrides,
});

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
  confidence: 0.85,
  model_version: "gnn-v1.2.0",
  factors: [mockRiskFactor],
  computed_at: "2024-01-10T14:20:00Z",
};

export const mockBatchRiskScore = {
  results: [
    {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
      risk_score: 0.65,
      risk_level: "medium",
    },
    {
      address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      risk_score: 0.25,
      risk_level: "low",
    },
  ],
  model_version: "gnn-v1.2.0",
};

export const mockRiskHistory = [
  {
    risk_score: 0.65,
    risk_level: "medium",
    computed_at: "2024-01-10T14:20:00Z",
  },
  {
    risk_score: 0.58,
    risk_level: "medium",
    computed_at: "2024-01-09T10:00:00Z",
  },
];

export const mockRiskRules = {
  rules: [
    {
      id: "rule-001",
      name: "High Risk Threshold",
      enabled: true,
      threshold: 0.8,
    },
  ],
};

// ============== Graph Service Fixtures ==============

export const mockGraphAddressInfo = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  riskScore: 0.65,
  tags: ["exchange", "high_volume"],
  inDegree: 150,
  outDegree: 200,
  totalValue: "3500.5",
  firstSeen: "2023-01-15T10:30:00Z",
  lastSeen: "2024-01-10T14:20:00Z",
};

export const mockGraphNode = {
  id: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  riskScore: 0.3,
  tags: ["defi"],
};

export const mockGraphEdge = {
  source: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  target: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  txCount: 5,
  totalValue: "15.5",
};

export const mockAddressNeighbors = {
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  depth: 1,
  nodes: [mockGraphNode],
  edges: [mockGraphEdge],
};

export const mockPathResponse = {
  found: true,
  fromAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  toAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  pathLength: 2,
  maxDepth: 5,
  message: "Path found",
  path: [{
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
    txHash: "0xabc123",
    value: "1.5",
    timestamp: "2024-01-10T14:20:00Z",
    riskScore: 0.65,
    tags: ["exchange"],
  }],
};

export const mockCluster = {
  clusterId: "cluster-001",
  label: "Exchange Hot Wallet",
  memberCount: 25,
  totalVolume: "50000.0",
  avgRisk: 0.35,
  addresses: [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
    "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  ],
};

// ============== Alert Service Fixtures ==============

export const mockAlert = {
  id: "alert-12345",
  type: "high_risk_transaction",
  severity: "high",
  status: "open",
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
  txHash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abcd",
  riskScore: 0.85,
  message: "High risk transaction detected",
  details: {
    value: "500.0",
    counterparty: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  },
  createdAt: "2024-01-10T14:20:00Z",
  updatedAt: "2024-01-10T14:20:00Z",
};

export const mockAlertList = {
  items: [mockAlert],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 45,
    totalPages: 3,
  },
};

export const mockAlertRule = {
  id: "rule-001",
  name: "High Risk Transaction",
  type: "risk_threshold",
  enabled: true,
  conditions: {
    riskScore: { gte: 0.8 },
  },
  actions: ["create_alert", "notify_slack"],
  createdAt: "2023-06-01T00:00:00Z",
};
