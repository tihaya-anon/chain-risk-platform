/**
 * MSW Request Handlers
 * Custom handlers with realistic mock data
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
} from "./data"

// ==================== Auth Handlers ====================

const DEMO_ACCOUNTS: Record<string, { password: string; role: "admin" | "user"; id: string }> = {
  admin: { password: "admin123", role: "admin", id: "1" },
  user: { password: "user123", role: "user", id: "2" },
}

function generateMockToken(payload: { sub: string; username: string; role: string }): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 }))
  const signature = btoa("mock-signature")
  return `${header}.${body}.${signature}`
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
  await delay(200)
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new HttpResponse(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split(".")[1]))
    return HttpResponse.json({ id: payload.sub, username: payload.username, role: payload.role })
  } catch {
    return new HttpResponse(JSON.stringify({ message: "Invalid token" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
})

// ==================== Orchestration Handlers ====================

const getAddressAnalysisHandler = http.get("*/api/v1/orchestration/address-analysis/:address", async ({ params }) => {
  await delay(500)
  const address = params.address as string
  return HttpResponse.json(mockAddressAnalysisResponse(address))
})

const getAddressProfileHandler = http.get("*/api/v1/orchestration/address-profile/:address", async ({ params }) => {
  await delay(500)
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

const getHighRiskNetworkHandler = http.get("*/api/v1/orchestration/high-risk-network", async () => {
  await delay(500)
  return HttpResponse.json(mockHighRiskNetworkResponse())
})

const findConnectionHandler = http.get("*/api/v1/orchestration/connection/:fromAddress/:toAddress", async ({ params }) => {
  await delay(800)
  return HttpResponse.json(mockConnectionResponse(params.fromAddress as string, params.toAddress as string))
})

const batchRiskAnalysisHandler = http.post("*/api/v1/orchestration/batch-risk-analysis", async ({ request }) => {
  await delay(500)
  const body = (await request.json()) as { addresses: string[] }
  return HttpResponse.json({
    results: body.addresses.map(addr => mockRiskScoreResponse(addr)),
    total: body.addresses.length,
    failed: 0,
  })
})

// ==================== BFF Graph Handlers ====================

const getAddressNeighborsHandler = http.get("*/api/v1/graph/addresses/:address/neighbors", async ({ params }) => {
  await delay(400)
  return HttpResponse.json(mockNeighborsResponse(params.address as string))
})

const getAddressInfoHandler = http.get("*/api/v1/graph/addresses/:address", async ({ params }) => {
  await delay(300)
  return HttpResponse.json(mockGraphAddressInfo(params.address as string))
})

const findPathHandler = http.get("*/api/v1/graph/path/:from/:to", async ({ params }) => {
  await delay(600)
  const pathLength = Math.floor(Math.random() * 4) + 2
  return HttpResponse.json({
    found: true,
    fromAddress: params.from,
    toAddress: params.to,
    pathLength,
    maxDepth: 6,
    message: "Path found",
    path: Array.from({ length: pathLength }, mockPathNode),
  })
})

const getHighRiskAddressesHandler = http.get("*/api/v1/graph/high-risk", async () => {
  await delay(400)
  const resp = mockHighRiskNetworkResponse()
  return HttpResponse.json({ addresses: resp.highRiskAddresses, total: resp.count })
})

const searchByTagHandler = http.get("*/api/v1/graph/tags/:tag/addresses", async () => {
  await delay(400)
  return HttpResponse.json({ addresses: Array.from({ length: 10 }, () => mockGraphAddressInfo()), total: 10 })
})

const runClusteringHandler = http.post("*/api/v1/graph/clustering/run", async () => {
  await delay(1000)
  return HttpResponse.json({ clustersCreated: Math.floor(Math.random() * 50) + 10, addressesClustered: Math.floor(Math.random() * 500) + 100, durationMs: Math.floor(Math.random() * 5000) + 1000 })
})

const manualClusterHandler = http.post("*/api/v1/graph/clustering/manual", async () => {
  await delay(500)
  return HttpResponse.json({ clustersCreated: 1, addressesClustered: Math.floor(Math.random() * 10) + 2, durationMs: Math.floor(Math.random() * 500) + 100 })
})

const propagateTagsHandler = http.post("*/api/v1/graph/tags/propagate", async () => {
  await delay(800)
  return HttpResponse.json({ addressesAffected: Math.floor(Math.random() * 100) + 20, tagsPropagated: Math.floor(Math.random() * 50) + 10, durationMs: Math.floor(Math.random() * 3000) + 500 })
})

const addTagHandler = http.post("*/api/v1/graph/addresses/:address/tags", async () => {
  await delay(300)
  return HttpResponse.json({ success: true, message: "Tag added successfully" })
})

const getClusterHandler = http.get("*/api/v1/graph/clusters/:clusterId", async () => {
  await delay(300)
  return HttpResponse.json(mockClusterResponse())
})

// ==================== BFF Risk Handlers ====================

const getRiskScoreHandler = http.get("*/api/v1/risk/:address", async ({ params }) => {
  await delay(400)
  return HttpResponse.json(mockRiskScoreResponse(params.address as string))
})

const getBatchRiskScoreHandler = http.post("*/api/v1/risk/batch", async ({ request }) => {
  await delay(500)
  const body = (await request.json()) as { addresses: string[] }
  return HttpResponse.json({ results: body.addresses.map(addr => mockRiskScoreResponse(addr)) })
})

// ==================== BFF Address Handlers ====================

const getAddressInfoBffHandler = http.get("*/api/v1/addresses/:address", async ({ params }) => {
  await delay(300)
  const info = mockGraphAddressInfo(params.address as string)
  return HttpResponse.json({ ...info, incomingCount: info.incomingCount, outgoingCount: info.outgoingCount })
})

const getAddressTransfersHandler = http.get("*/api/v1/addresses/:address/transfers", async () => {
  await delay(400)
  return HttpResponse.json({ items: Array.from({ length: 20 }, mockTransfer), pagination: { page: 1, pageSize: 20, total: 200, totalPages: 10 } })
})

const getAddressStatsHandler = http.get("*/api/v1/addresses/:address/stats", async () => {
  await delay(300)
  return HttpResponse.json({
    totalValueSent: (BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18)).toString(),
    totalValueReceived: (BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18)).toString(),
    avgTxValue: (BigInt(Math.floor(Math.random() * 10)) * BigInt(10 ** 18)).toString(),
    maxTxValue: (BigInt(Math.floor(Math.random() * 100)) * BigInt(10 ** 18)).toString(),
    minTxValue: (BigInt(Math.floor(Math.random() * 1)) * BigInt(10 ** 17)).toString(),
  })
})

// ==================== BFF Transfers Handlers ====================

const listTransfersHandler = http.get("*/api/v1/transfers", async () => {
  await delay(400)
  return HttpResponse.json({ items: Array.from({ length: 20 }, mockTransfer), pagination: { page: 1, pageSize: 20, total: 1000, totalPages: 50 } })
})

// ==================== Admin Handlers ====================

const getPipelineStatusHandler = http.get("*/api/admin/pipeline/status", async () => {
  await delay(300)
  return HttpResponse.json(mockPipelineStatus())
})

const getServicesHandler = http.get("*/api/admin/services", async () => {
  await delay(300)
  return HttpResponse.json(mockServices())
})

const getRiskConfigHandler = http.get("*/api/admin/config/risk", async () => {
  await delay(200)
  return HttpResponse.json(mockRiskConfig())
})

const getPipelineConfigHandler = http.get("*/api/admin/config/pipeline", async () => {
  await delay(200)
  return HttpResponse.json(mockPipelineConfig())
})

const getAllConfigHandler = http.get("*/api/admin/config", async () => {
  await delay(200)
  return HttpResponse.json({ risk: mockRiskConfig(), pipeline: mockPipelineConfig() })
})

const controlIngestionHandler = http.post("*/api/admin/pipeline/ingestion/:action", async ({ params }) => {
  await delay(300)
  return HttpResponse.json({ success: true, action: params.action, message: `Ingestion ${params.action} successful` })
})

const controlGraphSyncHandler = http.post("*/api/admin/pipeline/graph-sync/:action", async ({ params }) => {
  await delay(300)
  return HttpResponse.json({ success: true, action: params.action, message: `Graph sync ${params.action} successful` })
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
  getAddressNeighborsHandler,
  getAddressInfoHandler,
  findPathHandler,
  getHighRiskAddressesHandler,
  searchByTagHandler,
  runClusteringHandler,
  manualClusterHandler,
  propagateTagsHandler,
  addTagHandler,
  getClusterHandler,

  // BFF Risk
  getRiskScoreHandler,
  getBatchRiskScoreHandler,

  // BFF Address
  getAddressInfoBffHandler,
  getAddressTransfersHandler,
  getAddressStatsHandler,

  // BFF Transfers
  listTransfersHandler,

  // Admin
  getPipelineStatusHandler,
  getServicesHandler,
  getRiskConfigHandler,
  getPipelineConfigHandler,
  getAllConfigHandler,
  controlIngestionHandler,
  controlGraphSyncHandler,
]
