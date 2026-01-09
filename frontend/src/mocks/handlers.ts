/**
 * MSW Request Handlers
 */

import { http, HttpResponse, delay } from "msw"
import {
  mockAddressAnalysisResponse,
  mockHighRiskNetworkResponse,
  mockConnectionResponse,
  mockNeighborsResponse,
  mockGraphAddressInfo,
  mockRiskScoreResponse,
  mockPipelineStatus,
  mockServices,
  mockRiskConfig,
  mockPipelineConfig,
  mockTransfer,
  mockClusterResponse,
  mockPathNode,
  mockTags,
} from "./data"

// ==================== Auth Handlers ====================

const DEMO_ACCOUNTS: Record<
  string,
  { password: string; role: "admin" | "user"; id: string }
> = {
  admin: { password: "admin123", role: "admin", id: "1" },
  user: { password: "user123", role: "user", id: "2" },
}

function generateMockToken(payload: {
  sub: string
  username: string
  role: string
}): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(
    JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 })
  )
  return `${header}.${body}.${btoa("mock-signature")}`
}

const loginHandler = http.post("*/api/v1/auth/login", async ({ request }) => {
  await delay(300)
  const body = (await request.json()) as { username: string; password: string }
  const account = DEMO_ACCOUNTS[body.username]
  if (!account || account.password !== body.password) {
    return new HttpResponse(JSON.stringify({ message: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  return HttpResponse.json({
    accessToken: generateMockToken({
      sub: account.id,
      username: body.username,
      role: account.role,
    }),
    tokenType: "Bearer",
    expiresIn: "24h",
  })
})

const profileHandler = http.get("*/api/v1/auth/profile", async ({ request }) => {
  await delay(100)
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new HttpResponse(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
  }
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split(".")[1]))
    return HttpResponse.json({
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    })
  } catch {
    return new HttpResponse(JSON.stringify({ message: "Invalid token" }), { status: 401 })
  }
})

// ==================== Orchestration Handlers ====================

const getAddressAnalysisHandler = http.get(
  "*/api/v1/orchestration/address-analysis/:address",
  async ({ params }) => {
    await delay(400)
    return HttpResponse.json(mockAddressAnalysisResponse(params.address as string))
  }
)

const getAddressProfileHandler = http.get(
  "*/api/v1/orchestration/address-profile/:address",
  async ({ params }) => {
    await delay(400)
    const address = params.address as string
    const analysis = mockAddressAnalysisResponse(address)
    return HttpResponse.json({
      address,
      network: "ethereum",
      addressInfo: analysis.basic?.addressInfo,
      riskScore: analysis.basic?.riskScore,
      recentTransfers: {
        items: Array.from({ length: 10 }, mockTransfer),
        pagination: { page: 1, pageSize: 10, total: 100, totalPages: 10 },
      },
      orchestratedAt: Date.now(),
    })
  }
)

const getHighRiskNetworkHandler = http.get(
  "*/api/v1/orchestration/high-risk-network",
  async () => {
    await delay(400)
    return HttpResponse.json(mockHighRiskNetworkResponse())
  }
)

const findConnectionHandler = http.get(
  "*/api/v1/orchestration/connection/:fromAddress/:toAddress",
  async ({ params }) => {
    await delay(600)
    return HttpResponse.json(
      mockConnectionResponse(params.fromAddress as string, params.toAddress as string)
    )
  }
)

const batchRiskAnalysisHandler = http.post(
  "*/api/v1/orchestration/batch-risk-analysis",
  async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as { addresses: string[] }
    return HttpResponse.json({
      results: body.addresses.map((addr) => mockRiskScoreResponse(addr)),
      total: body.addresses.length,
      failed: 0,
    })
  }
)

// ==================== BFF Graph Handlers ====================

const graphGetAddressHandler = http.get(
  "*/api/v1/graph/address/:address",
  async ({ params }) => {
    await delay(200)
    return HttpResponse.json(mockGraphAddressInfo(params.address as string))
  }
)

const graphGetNeighborsHandler = http.get(
  "*/api/v1/graph/address/:address/neighbors",
  async ({ params, request }) => {
    await delay(300)
    const url = new URL(request.url)
    const depth = parseInt(url.searchParams.get("depth") || "1", 10)
    return HttpResponse.json(mockNeighborsResponse(params.address as string, depth))
  }
)

const graphGetTagsHandler = http.get("*/api/v1/graph/address/:address/tags", async () => {
  await delay(100)
  return HttpResponse.json({ tags: mockTags(5) })
})

const graphAddTagHandler = http.post("*/api/v1/graph/address/:address/tags", async () => {
  await delay(200)
  return HttpResponse.json({ success: true, message: "Tag added" })
})

const graphRemoveTagHandler = http.delete(
  "*/api/v1/graph/address/:address/tags/:tag",
  async () => {
    await delay(200)
    return HttpResponse.json({ success: true, message: "Tag removed" })
  }
)

const graphGetAddressClusterHandler = http.get(
  "*/api/v1/graph/address/:address/cluster",
  async () => {
    await delay(200)
    return HttpResponse.json(mockClusterResponse())
  }
)

const graphFindPathHandler = http.get(
  "*/api/v1/graph/path/:fromAddress/:toAddress",
  async ({ params }) => {
    await delay(500)
    const pathLength = Math.floor(Math.random() * 4) + 2
    return HttpResponse.json({
      found: true,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      pathLength,
      maxDepth: 6,
      message: "Path found",
      path: Array.from({ length: pathLength }, mockPathNode),
    })
  }
)

const graphGetClusterHandler = http.get("*/api/v1/graph/cluster/:clusterId", async () => {
  await delay(200)
  return HttpResponse.json(mockClusterResponse())
})

const graphRunClusteringHandler = http.post("*/api/v1/graph/cluster/run", async () => {
  await delay(800)
  return HttpResponse.json({
    clustersCreated: Math.floor(Math.random() * 50) + 10,
    addressesClustered: Math.floor(Math.random() * 500) + 100,
    durationMs: Math.floor(Math.random() * 5000) + 1000,
  })
})

const graphManualClusterHandler = http.post("*/api/v1/graph/cluster/manual", async () => {
  await delay(400)
  return HttpResponse.json({
    clustersCreated: 1,
    addressesClustered: Math.floor(Math.random() * 10) + 2,
    durationMs: Math.floor(Math.random() * 500) + 100,
  })
})

const graphSearchByTagHandler = http.get("*/api/v1/graph/search/tag/:tag", async () => {
  await delay(300)
  return HttpResponse.json(Array.from({ length: 10 }, () => mockGraphAddressInfo()))
})

const graphHighRiskHandler = http.get("*/api/v1/graph/search/high-risk", async () => {
  await delay(300)
  const resp = mockHighRiskNetworkResponse()
  return HttpResponse.json(resp.highRiskAddresses)
})

const graphPropagateHandler = http.post("*/api/v1/graph/propagate", async () => {
  await delay(600)
  return HttpResponse.json({
    addressesAffected: Math.floor(Math.random() * 100) + 20,
    tagsPropagated: Math.floor(Math.random() * 50) + 10,
    durationMs: Math.floor(Math.random() * 3000) + 500,
  })
})

const graphPropagateAddressHandler = http.post(
  "*/api/v1/graph/propagate/:address",
  async () => {
    await delay(400)
    return HttpResponse.json({ success: true, message: "Tags propagated for address" })
  }
)

// ==================== BFF Risk Handlers ====================

const riskScoreHandler = http.post("*/api/v1/risk/score", async ({ request }) => {
  await delay(300)
  const body = (await request.json()) as { address: string; network?: string }
  return HttpResponse.json(mockRiskScoreResponse(body.address))
})

const riskBatchScoreHandler = http.post(
  "*/api/v1/risk/score/batch",
  async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as { addresses: string[] }
    return HttpResponse.json({
      results: body.addresses.map((addr) => mockRiskScoreResponse(addr)),
    })
  }
)

const riskRulesHandler = http.get("*/api/v1/risk/rules", async () => {
  await delay(200)
  return HttpResponse.json([
    {
      id: "1",
      name: "Mixer Interaction",
      description: "Detects interactions with known mixer services",
      enabled: true,
      weight: 0.3,
    },
    {
      id: "2",
      name: "Sanctioned Entity",
      description: "Checks against OFAC sanctions list",
      enabled: true,
      weight: 0.5,
    },
    {
      id: "3",
      name: "High Volume",
      description: "Flags unusually high transaction volumes",
      enabled: true,
      weight: 0.2,
    },
    {
      id: "4",
      name: "New Address",
      description: "Recently created addresses with suspicious patterns",
      enabled: false,
      weight: 0.1,
    },
    {
      id: "5",
      name: "Darknet Market",
      description: "Known darknet marketplace addresses",
      enabled: true,
      weight: 0.4,
    },
  ])
})

// ==================== BFF Address Handlers ====================

const addressInfoHandler = http.get("*/api/v1/addresses/:address", async ({ params }) => {
  await delay(200)
  return HttpResponse.json(mockGraphAddressInfo(params.address as string))
})

const addressTransfersHandler = http.get(
  "*/api/v1/addresses/:address/transfers",
  async () => {
    await delay(300)
    return HttpResponse.json({
      items: Array.from({ length: 20 }, mockTransfer),
      pagination: { page: 1, pageSize: 20, total: 200, totalPages: 10 },
    })
  }
)

const addressStatsHandler = http.get("*/api/v1/addresses/:address/stats", async () => {
  await delay(200)
  return HttpResponse.json({
    totalValueSent: String(BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18)),
    totalValueReceived: String(
      BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18))
    ,
    avgTxValue: String(BigInt(Math.floor(Math.random() * 10)) * BigInt(10 ** 18)),
    maxTxValue: String(BigInt(Math.floor(Math.random() * 100)) * BigInt(10 ** 18)),
    minTxValue: String(BigInt(Math.floor(Math.random() * 1)) * BigInt(10 ** 17)),
  })
})

// ==================== BFF Transfers Handlers ====================

const listTransfersHandler = http.get("*/api/v1/transfers", async () => {
  await delay(300)
  return HttpResponse.json({
    items: Array.from({ length: 20 }, mockTransfer),
    pagination: { page: 1, pageSize: 20, total: 1000, totalPages: 50 },
  })
})

// ==================== Alert Handlers ====================

const MOCK_ALERT_RULES = [
  {
    id: 1,
    name: "High Risk Score",
    description: "Alert when address risk score exceeds threshold",
    ruleType: "risk_score",
    severity: "high",
    enabled: true,
    conditions: { operator: "gt", threshold: 80 },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    name: "Mixer Interaction",
    description: "Alert when address interacts with known mixer",
    ruleType: "tag_detected",
    severity: "critical",
    enabled: true,
    conditions: { tags: ["mixer", "tornado-cash"] },
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    name: "Large Transfer",
    description: "Alert on transfers exceeding 100 ETH",
    ruleType: "large_transfer",
    severity: "medium",
    enabled: true,
    conditions: { threshold: "100000000000000000000" },
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    name: "Sanctioned Entity",
    description: "Alert when address is on sanctions list",
    ruleType: "tag_detected",
    severity: "critical",
    enabled: true,
    conditions: { tags: ["ofac", "sanctioned"] },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    name: "New High Value Address",
    description: "Alert on new addresses with high activity",
    ruleType: "risk_score",
    severity: "low",
    enabled: false,
    conditions: { operator: "gt", threshold: 50 },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

function generateMockAlertHistory(count: number) {
  const severities = ["critical", "high", "medium", "low"] as const
  const statuses = ["pending", "acknowledged", "resolved"] as const
  const ruleTypes = ["risk_score", "tag_detected", "large_transfer"] as const

  return Array.from({ length: count }, (_, i) => {
    const severity = severities[Math.floor(Math.random() * severities.length)]
    const ruleType = ruleTypes[Math.floor(Math.random() * ruleTypes.length)]
    const address = `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`
    const rule = MOCK_ALERT_RULES[Math.floor(Math.random() * MOCK_ALERT_RULES.length)]

    return {
      id: i + 1,
      ruleId: rule.id,
      ruleName: rule.name,
      severity,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      title: `${severity.charAt(0).toUpperCase() + severity.slice(1)} Alert: ${rule.name}`,
      message: `Address ${address.slice(0, 10)}...${address.slice(-8)} triggered ${rule.name.toLowerCase()} rule`,
      entityType: "address",
      entityId: address,
      metadata: { ruleType, threshold: rule.conditions },
      createdAt: new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      ).toISOString(),
      acknowledgedAt:
        Math.random() > 0.5
          ? new Date(
              Date.now() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000)
            ).toISOString()
          : null,
      resolvedAt:
        Math.random() > 0.7
          ? new Date(
              Date.now() - Math.floor(Math.random() * 1 * 24 * 60 * 60 * 1000)
            ).toISOString()
          : null,
    }
  })
}

const alertRulesHandler = http.get("*/api/v1/alerts/rules", async () => {
  await delay(200)
  return HttpResponse.json(MOCK_ALERT_RULES)
})

const alertRuleByIdHandler = http.get("*/api/v1/alerts/rules/:id", async ({ params }) => {
  await delay(100)
  const rule = MOCK_ALERT_RULES.find((r) => r.id === Number(params.id))
  if (!rule) {
    return new HttpResponse(JSON.stringify({ message: "Rule not found" }), { status: 404 })
  }
  return HttpResponse.json(rule)
})

const createAlertRuleHandler = http.post("*/api/v1/alerts/rules", async ({ request }) => {
  await delay(300)
  const body = (await request.json()) as Record<string, unknown>
  const newRule = {
    id: MOCK_ALERT_RULES.length + 1,
    ...body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return HttpResponse.json(newRule, { status: 201 })
})

const updateAlertRuleHandler = http.patch(
  "*/api/v1/alerts/rules/:id",
  async ({ params, request }) => {
    await delay(200)
    const body = (await request.json()) as Record<string, unknown>
    const rule = MOCK_ALERT_RULES.find((r) => r.id === Number(params.id))
    if (!rule) {
      return new HttpResponse(JSON.stringify({ message: "Rule not found" }), {
        status: 404,
      })
    }
    return HttpResponse.json({ ...rule, ...body, updatedAt: new Date().toISOString() })
  }
)

const deleteAlertRuleHandler = http.delete(
  "*/api/v1/alerts/rules/:id",
  async ({ params }) => {
    await delay(200)
    const rule = MOCK_ALERT_RULES.find((r) => r.id === Number(params.id))
    if (!rule) {
      return new HttpResponse(JSON.stringify({ message: "Rule not found" }), {
        status: 404,
      })
    }
    return new HttpResponse(null, { status: 204 })
  }
)

const alertHistoryHandler = http.get("*/api/v1/alerts/history", async ({ request }) => {
  await delay(250)
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") || "1", 10)
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10)
  const total = 87

  const data = generateMockAlertHistory(Math.min(pageSize, total - (page - 1) * pageSize))

  return HttpResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
})

const alertStatsHandler = http.get("*/api/v1/alerts/stats", async ({ request }) => {
  await delay(150)
  const url = new URL(request.url)
  const hours = parseInt(url.searchParams.get("hours") || "24", 10)

  const baseCount = hours <= 24 ? 15 : hours <= 168 ? 45 : 120

  return HttpResponse.json({
    total: baseCount + Math.floor(Math.random() * 10),
    pending: Math.floor(baseCount * 0.4) + Math.floor(Math.random() * 5),
    acknowledged: Math.floor(baseCount * 0.35) + Math.floor(Math.random() * 3),
    resolved: Math.floor(baseCount * 0.25) + Math.floor(Math.random() * 2),
    bySeverity: {
      critical: Math.floor(baseCount * 0.1) + Math.floor(Math.random() * 2),
      high: Math.floor(baseCount * 0.25) + Math.floor(Math.random() * 3),
      medium: Math.floor(baseCount * 0.4) + Math.floor(Math.random() * 4),
      low: Math.floor(baseCount * 0.25) + Math.floor(Math.random() * 2),
    },
    hours,
  })
})

const acknowledgeAlertHandler = http.post(
  "*/api/v1/alerts/history/:id/acknowledge",
  async ({ params }) => {
    await delay(200)
    return HttpResponse.json({
      id: Number(params.id),
      status: "acknowledged",
      acknowledgedAt: new Date().toISOString(),
    })
  }
)

const resolveAlertHandler = http.post(
  "*/api/v1/alerts/history/:id/resolve",
  async ({ params }) => {
    await delay(200)
    return HttpResponse.json({
      id: Number(params.id),
      status: "resolved",
      resolvedAt: new Date().toISOString(),
    })
  }
)

const MOCK_SUBSCRIPTIONS = [
  {
    id: 1,
    userId: "1",
    ruleId: 1,
    channelType: "email",
    channelConfig: { email: "alerts@example.com" },
    enabled: true,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    userId: "1",
    ruleId: 2,
    channelType: "slack",
    channelConfig: { webhook_url: "https://hooks.slack.com/...", channel: "#alerts" },
    enabled: true,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    userId: "1",
    ruleId: undefined,
    channelType: "webhook",
    channelConfig: { url: "https://api.example.com/webhooks/alerts" },
    enabled: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

const subscriptionsHandler = http.get("*/api/v1/alerts/subscriptions", async () => {
  await delay(200)
  return HttpResponse.json(MOCK_SUBSCRIPTIONS)
})

const createSubscriptionHandler = http.post(
  "*/api/v1/alerts/subscriptions",
  async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const newSub = {
      id: MOCK_SUBSCRIPTIONS.length + 1,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json(newSub, { status: 201 })
  }
)

const deleteSubscriptionHandler = http.delete(
  "*/api/v1/alerts/subscriptions/:id",
  async ({ params }) => {
    await delay(200)
    const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === Number(params.id))
    if (!sub) {
      return new HttpResponse(JSON.stringify({ message: "Subscription not found" }), {
        status: 404,
      })
    }
    return new HttpResponse(null, { status: 204 })
  }
)

// ==================== Admin Handlers ====================

const adminIngestionHandler = http.post(
  "*/api/admin/pipeline/ingestion/:action",
  async ({ params }) => {
    await delay(300)
    return HttpResponse.json({
      success: true,
      action: params.action,
      message: `Ingestion ${params.action} successful`,
    })
  }
)

const adminServicesHandler = http.get("*/api/admin/services", async () => {
  await delay(200)
  return HttpResponse.json(mockServices())
})

const adminServiceHandler = http.get(
  "*/api/admin/services/:serviceName",
  async ({ params }) => {
    await delay(200)
    const services = mockServices()
    const service = services.find((s) => s.name === params.serviceName) || services[0]
    return HttpResponse.json(service)
  }
)

const adminPipelineStatusHandler = http.get("*/api/admin/pipeline/status", async () => {
  await delay(200)
  return HttpResponse.json(mockPipelineStatus())
})

const adminRiskConfigHandler = http.get("*/api/admin/config/risk", async () => {
  await delay(200)
  return HttpResponse.json(mockRiskConfig())
})

const adminPipelineConfigHandler = http.get("*/api/admin/config/pipeline", async () => {
  await delay(200)
  return HttpResponse.json(mockPipelineConfig())
})

const adminAllConfigHandler = http.get("*/api/admin/config/all", async () => {
  await delay(200)
  return HttpResponse.json({ risk: mockRiskConfig(), pipeline: mockPipelineConfig() })
})

// ==================== Export All Handlers ====================

export const handlers = [
  // Auth
  loginHandler,
  profileHandler,

  // Orchestration
  getAddressAnalysisHandler,
  getAddressProfileHandler,
  getHighRiskNetworkHandler,
  findConnectionHandler,
  batchRiskAnalysisHandler,

  // BFF Graph
  graphGetAddressHandler,
  graphGetNeighborsHandler,
  graphGetTagsHandler,
  graphAddTagHandler,
  graphRemoveTagHandler,
  graphGetAddressClusterHandler,
  graphFindPathHandler,
  graphGetClusterHandler,
  graphRunClusteringHandler,
  graphManualClusterHandler,
  graphSearchByTagHandler,
  graphHighRiskHandler,
  graphPropagateHandler,
  graphPropagateAddressHandler,

  // BFF Risk
  riskScoreHandler,
  riskBatchScoreHandler,
  riskRulesHandler,

  // BFF Address
  addressInfoHandler,
  addressTransfersHandler,
  addressStatsHandler,

  // BFF Transfers
  listTransfersHandler,

  // Alerts
  alertRulesHandler,
  alertRuleByIdHandler,
  createAlertRuleHandler,
  updateAlertRuleHandler,
  deleteAlertRuleHandler,
  alertHistoryHandler,
  alertStatsHandler,
  acknowledgeAlertHandler,
  resolveAlertHandler,
  subscriptionsHandler,
  createSubscriptionHandler,
  deleteSubscriptionHandler,

  // Admin
  adminIngestionHandler,
  adminServicesHandler,
  adminServiceHandler,
  adminPipelineStatusHandler,
  adminRiskConfigHandler,
  adminPipelineConfigHandler,
  adminAllConfigHandler,
]
