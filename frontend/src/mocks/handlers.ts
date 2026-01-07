/**
 * MSW Request Handlers - Fixed API paths to match generated hooks
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

const DEMO_ACCOUNTS: Record<string, { password: string; role: "admin" | "user"; id: string }> = {
  admin: { password: "admin123", role: "admin", id: "1" },
  user: { password: "user123", role: "user", id: "2" },
}

function generateMockToken(payload: { sub: string; username: string; role: string }): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 }))
  return `${header}.${body}.${btoa("mock-signature")}`
}

const loginHandler = http.post("*/api/v1/auth/login", async ({ request }) => {
  await delay(300)
  const body = (await request.json()) as { username: string; password: string }
  const account = DEMO_ACCOUNTS[body.username]
  if (!account || account.password !== body.password) {
    return new HttpResponse(JSON.stringify({ message: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  return HttpResponse.json({ accessToken: generateMockToken({ sub: account.id, username: body.username, role: account.role }), tokenType: "Bearer", expiresIn: "24h" })
})

const profileHandler = http.get("*/api/v1/auth/profile", async ({ request }) => {
  await delay(100)
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new HttpResponse(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
  }
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split(".")[1]))
    return HttpResponse.json({ id: payload.sub, username: payload.username, role: payload.role })
  } catch {
    return new HttpResponse(JSON.stringify({ message: "Invalid token" }), { status: 401 })
  }
})

// ==================== Orchestration Handlers ====================

// GET /api/v1/orchestration/address-analysis/:address
const getAddressAnalysisHandler = http.get("*/api/v1/orchestration/address-analysis/:address", async ({ params }) => {
  await delay(400)
  return HttpResponse.json(mockAddressAnalysisResponse(params.address as string))
})

// GET /api/v1/orchestration/address-profile/:address
const getAddressProfileHandler = http.get("*/api/v1/orchestration/address-profile/:address", async ({ params }) => {
  await delay(400)
  const address = params.address as string
  const analysis = mockAddressAnalysisResponse(address)
  return HttpResponse.json({
    address,
    network: "ethereum",
    addressInfo: analysis.basic?.addressInfo,
    riskScore: analysis.basic?.riskScore,
    recentTransfers: { items: Array.from({ length: 10 }, mockTransfer), pagination: { page: 1, pageSize: 10, total: 100, totalPages: 10 } },
    orchestratedAt: Date.now(),
  })
})

// GET /api/v1/orchestration/high-risk-network
const getHighRiskNetworkHandler = http.get("*/api/v1/orchestration/high-risk-network", async () => {
  await delay(400)
  return HttpResponse.json(mockHighRiskNetworkResponse())
})

// GET /api/v1/orchestration/connection/:fromAddress/:toAddress
const findConnectionHandler = http.get("*/api/v1/orchestration/connection/:fromAddress/:toAddress", async ({ params }) => {
  await delay(600)
  return HttpResponse.json(mockConnectionResponse(params.fromAddress as string, params.toAddress as string))
})

// POST /api/v1/orchestration/batch-risk-analysis
const batchRiskAnalysisHandler = http.post("*/api/v1/orchestration/batch-risk-analysis", async ({ request }) => {
  await delay(400)
  const body = (await request.json()) as { addresses: string[] }
  return HttpResponse.json({
    results: body.addresses.map(addr => mockRiskScoreResponse(addr)),
    total: body.addresses.length,
    failed: 0,
  })
})

// ==================== BFF Graph Handlers (FIXED PATHS) ====================

// GET /api/v1/graph/address/:address
const graphGetAddressHandler = http.get("*/api/v1/graph/address/:address", async ({ params }) => {
  await delay(200)
  return HttpResponse.json(mockGraphAddressInfo(params.address as string))
})

// GET /api/v1/graph/address/:address/neighbors
const graphGetNeighborsHandler = http.get("*/api/v1/graph/address/:address/neighbors", async ({ params }) => {
  await delay(300)
  return HttpResponse.json(mockNeighborsResponse(params.address as string))
})

// GET /api/v1/graph/address/:address/tags
const graphGetTagsHandler = http.get("*/api/v1/graph/address/:address/tags", async () => {
  await delay(100)
  return HttpResponse.json({ tags: mockTags(5) })
})

// POST /api/v1/graph/address/:address/tags
const graphAddTagHandler = http.post("*/api/v1/graph/address/:address/tags", async () => {
  await delay(200)
  return HttpResponse.json({ success: true, message: "Tag added" })
})

// DELETE /api/v1/graph/address/:address/tags/:tag
const graphRemoveTagHandler = http.delete("*/api/v1/graph/address/:address/tags/:tag", async () => {
  await delay(200)
  return HttpResponse.json({ success: true, message: "Tag removed" })
})

// GET /api/v1/graph/address/:address/cluster
const graphGetAddressClusterHandler = http.get("*/api/v1/graph/address/:address/cluster", async () => {
  await delay(200)
  return HttpResponse.json(mockClusterResponse())
})

// GET /api/v1/graph/path/:fromAddress/:toAddress
const graphFindPathHandler = http.get("*/api/v1/graph/path/:fromAddress/:toAddress", async ({ params }) => {
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
})

// GET /api/v1/graph/cluster/:clusterId
const graphGetClusterHandler = http.get("*/api/v1/graph/cluster/:clusterId", async () => {
  await delay(200)
  return HttpResponse.json(mockClusterResponse())
})

// POST /api/v1/graph/cluster/run
const graphRunClusteringHandler = http.post("*/api/v1/graph/cluster/run", async () => {
  await delay(800)
  return HttpResponse.json({
    clustersCreated: Math.floor(Math.random() * 50) + 10,
    addressesClustered: Math.floor(Math.random() * 500) + 100,
    durationMs: Math.floor(Math.random() * 5000) + 1000,
  })
})

// POST /api/v1/graph/cluster/manual
const graphManualClusterHandler = http.post("*/api/v1/graph/cluster/manual", async () => {
  await delay(400)
  return HttpResponse.json({
    clustersCreated: 1,
    addressesClustered: Math.floor(Math.random() * 10) + 2,
    durationMs: Math.floor(Math.random() * 500) + 100,
  })
})

// GET /api/v1/graph/search/tag/:tag (FIXED: was /api/v1/graph/tags/:tag/addresses)
const graphSearchByTagHandler = http.get("*/api/v1/graph/search/tag/:tag", async () => {
  await delay(300)
  return HttpResponse.json(Array.from({ length: 10 }, () => mockGraphAddressInfo()))
})

// GET /api/v1/graph/search/high-risk (FIXED: was /api/v1/graph/high-risk)
const graphHighRiskHandler = http.get("*/api/v1/graph/search/high-risk", async () => {
  await delay(300)
  const resp = mockHighRiskNetworkResponse()
  return HttpResponse.json(resp.highRiskAddresses)
})

// POST /api/v1/graph/propagate
const graphPropagateHandler = http.post("*/api/v1/graph/propagate", async () => {
  await delay(600)
  return HttpResponse.json({
    addressesAffected: Math.floor(Math.random() * 100) + 20,
    tagsPropagated: Math.floor(Math.random() * 50) + 10,
    durationMs: Math.floor(Math.random() * 3000) + 500,
  })
})

// POST /api/v1/graph/propagate/:address
const graphPropagateAddressHandler = http.post("*/api/v1/graph/propagate/:address", async () => {
  await delay(400)
  return HttpResponse.json({ success: true, message: "Tags propagated for address" })
})

// ==================== BFF Risk Handlers (FIXED PATHS) ====================

// POST /api/v1/risk/score (FIXED: was GET /api/v1/risk/:address)
const riskScoreHandler = http.post("*/api/v1/risk/score", async ({ request }) => {
  await delay(300)
  const body = (await request.json()) as { address: string; network?: string }
  return HttpResponse.json(mockRiskScoreResponse(body.address))
})

// POST /api/v1/risk/score/batch
const riskBatchScoreHandler = http.post("*/api/v1/risk/score/batch", async ({ request }) => {
  await delay(400)
  const body = (await request.json()) as { addresses: string[] }
  return HttpResponse.json({ results: body.addresses.map(addr => mockRiskScoreResponse(addr)) })
})

// GET /api/v1/risk/rules
const riskRulesHandler = http.get("*/api/v1/risk/rules", async () => {
  await delay(200)
  return HttpResponse.json([
    { id: "1", name: "Mixer Interaction", description: "Detects interactions with known mixer services", enabled: true, weight: 0.3 },
    { id: "2", name: "Sanctioned Entity", description: "Checks against OFAC sanctions list", enabled: true, weight: 0.5 },
    { id: "3", name: "High Volume", description: "Flags unusually high transaction volumes", enabled: true, weight: 0.2 },
    { id: "4", name: "New Address", description: "Recently created addresses with suspicious patterns", enabled: false, weight: 0.1 },
    { id: "5", name: "Darknet Market", description: "Known darknet marketplace addresses", enabled: true, weight: 0.4 },
  ])
})

// ==================== BFF Address Handlers ====================

// GET /api/v1/addresses/:address
const addressInfoHandler = http.get("*/api/v1/addresses/:address", async ({ params }) => {
  await delay(200)
  return HttpResponse.json(mockGraphAddressInfo(params.address as string))
})

// GET /api/v1/addresses/:address/transfers
const addressTransfersHandler = http.get("*/api/v1/addresses/:address/transfers", async () => {
  await delay(300)
  return HttpResponse.json({
    items: Array.from({ length: 20 }, mockTransfer),
    pagination: { page: 1, pageSize: 20, total: 200, totalPages: 10 },
  })
})

// GET /api/v1/addresses/:address/stats
const addressStatsHandler = http.get("*/api/v1/addresses/:address/stats", async () => {
  await delay(200)
  return HttpResponse.json({
    totalValueSent: String(BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18)),
    totalValueReceived: String(BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18)),
    avgTxValue: String(BigInt(Math.floor(Math.random() * 10)) * BigInt(10 ** 18)),
    maxTxValue: String(BigInt(Math.floor(Math.random() * 100)) * BigInt(10 ** 18)),
    minTxValue: String(BigInt(Math.floor(Math.random() * 1)) * BigInt(10 ** 17)),
  })
})

// ==================== BFF Transfers Handlers ====================

// GET /api/v1/transfers
const listTransfersHandler = http.get("*/api/v1/transfers", async () => {
  await delay(300)
  return HttpResponse.json({
    items: Array.from({ length: 20 }, mockTransfer),
    pagination: { page: 1, pageSize: 20, total: 1000, totalPages: 50 },
  })
})

// ==================== Admin Handlers (FIXED PATHS) ====================

// POST /api/admin/pipeline/ingestion/:action
const adminIngestionHandler = http.post("*/api/admin/pipeline/ingestion/:action", async ({ params }) => {
  await delay(300)
  return HttpResponse.json({ success: true, action: params.action, message: `Ingestion ${params.action} successful` })
})

// POST /api/admin/pipeline/graph-sync/:action
const adminGraphSyncHandler = http.post("*/api/admin/pipeline/graph-sync/:action", async ({ params }) => {
  await delay(300)
  return HttpResponse.json({ success: true, action: params.action, message: `Graph sync ${params.action} successful` })
})

// GET /api/admin/services
const adminServicesHandler = http.get("*/api/admin/services", async () => {
  await delay(200)
  return HttpResponse.json(mockServices())
})

// GET /api/admin/services/:serviceName
const adminServiceHandler = http.get("*/api/admin/services/:serviceName", async ({ params }) => {
  await delay(200)
  const services = mockServices()
  const service = services.find(s => s.name === params.serviceName) || services[0]
  return HttpResponse.json(service)
})

// GET /api/admin/pipeline/status
const adminPipelineStatusHandler = http.get("*/api/admin/pipeline/status", async () => {
  await delay(200)
  return HttpResponse.json(mockPipelineStatus())
})

// GET /api/admin/config/risk
const adminRiskConfigHandler = http.get("*/api/admin/config/risk", async () => {
  await delay(200)
  return HttpResponse.json(mockRiskConfig())
})

// GET /api/admin/config/pipeline
const adminPipelineConfigHandler = http.get("*/api/admin/config/pipeline", async () => {
  await delay(200)
  return HttpResponse.json(mockPipelineConfig())
})

// GET /api/admin/config/all (FIXED: was /api/admin/config)
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

  // Admin
  adminIngestionHandler,
  adminGraphSyncHandler,
  adminServicesHandler,
  adminServiceHandler,
  adminPipelineStatusHandler,
  adminRiskConfigHandler,
  adminPipelineConfigHandler,
  adminAllConfigHandler,
]
