/**
 * MSW Request Handlers
 * Define all API endpoint mocks using MSW
 */

import { http, HttpResponse, delay } from "msw"
import {
  generateLoginResponse,
  generateUser,
  generateAddressInfo,
  generateTransfers,
  generateAddressStats,
  generateRiskScore,
  generateBatchRiskScores,
  riskRules,
  generateGraphAddressInfo,
  generateNeighborsResponse,
  generatePathResponse,
  generateClusterResponse,
  generateSyncStatus,
  generatePropagationResult,
  generateClusteringResult,
  generateHighRiskAddresses,
  generateAddressAnalysis,
  generateConnectionResponse,
  generateHighRiskNetworkResponse,
  randomTags,
  generateServicesInfo,
  generatePipelineStatus,
  generateRiskConfig,
  generatePipelineConfig,
} from "./data"

const API_BASE = "/api/v1"

export const handlers = [
  // ============ Auth Handlers ============

  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as { username: string; password: string }

    // Validate credentials
    if (
      (body.username === "admin" && body.password === "admin123") ||
      (body.username === "user" && body.password === "user123")
    ) {
      const role = body.username === "admin" ? "admin" : "user"
      return HttpResponse.json(generateLoginResponse(body.username, role))
    }

    return HttpResponse.json({ message: "Invalid credentials" }, { status: 401 })
  }),

  http.get(`${API_BASE}/auth/profile`, async ({ request }) => {
    await delay(200)
    const authHeader = request.headers.get("Authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return HttpResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Decode token to get user info
    try {
      const token = authHeader.split(" ")[1]
      const payload = JSON.parse(atob(token.split(".")[1]))
      return HttpResponse.json(generateUser(payload.username, payload.role))
    } catch {
      return HttpResponse.json({ message: "Invalid token" }, { status: 401 })
    }
  }),

  // ============ Address Handlers ============

  http.get(`${API_BASE}/addresses/:address`, async ({ params }) => {
    await delay(400)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    return HttpResponse.json(generateAddressInfo(address))
  }),

  http.get(`${API_BASE}/addresses/:address/transfers`, async ({ params, request }) => {
    await delay(500)
    const { address } = params
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20")

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    const transfers = generateTransfers(address, pageSize)
    return HttpResponse.json({
      ...transfers,
      pagination: {
        ...transfers.pagination,
        page,
        pageSize,
      },
    })
  }),

  http.get(`${API_BASE}/addresses/:address/stats`, async ({ params }) => {
    await delay(350)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    return HttpResponse.json(generateAddressStats())
  }),

  // ============ Risk Handlers ============

  http.post(`${API_BASE}/risk/score`, async ({ request }) => {
    await delay(600)
    const body = (await request.json()) as { address: string; network?: string }

    if (!body.address) {
      return HttpResponse.json({ message: "Address is required" }, { status: 400 })
    }

    return HttpResponse.json(generateRiskScore(body.address))
  }),

  http.post(`${API_BASE}/risk/score/batch`, async ({ request }) => {
    await delay(800)
    const body = (await request.json()) as { addresses: string[]; network?: string }

    if (!body.addresses || !Array.isArray(body.addresses)) {
      return HttpResponse.json(
        { message: "Addresses array is required" },
        { status: 400 }
      )
    }

    if (body.addresses.length > 100) {
      return HttpResponse.json(
        { message: "Maximum 100 addresses per batch" },
        { status: 400 }
      )
    }

    return HttpResponse.json(generateBatchRiskScores(body.addresses))
  }),

  http.get(`${API_BASE}/risk/rules`, async () => {
    await delay(200)
    return HttpResponse.json(riskRules)
  }),

  http.get(`${API_BASE}/risk/rules/:name`, async ({ params }) => {
    await delay(200)
    const { name } = params
    const rule = riskRules.find((r) => r.name === name)

    if (!rule) {
      return HttpResponse.json({ message: "Rule not found" }, { status: 404 })
    }

    return HttpResponse.json(rule)
  }),

  http.put(`${API_BASE}/risk/rules/:name`, async ({ params, request }) => {
    await delay(300)
    const { name } = params
    const body = (await request.json()) as Partial<{
      description: string
      weight: number
      enabled: boolean
    }>

    const rule = riskRules.find((r) => r.name === name)
    if (!rule) {
      return HttpResponse.json({ message: "Rule not found" }, { status: 404 })
    }

    // Simulate update
    const updatedRule = {
      ...rule,
      ...body,
    }

    return HttpResponse.json(updatedRule)
  }),

  http.post(`${API_BASE}/risk/rules`, async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as {
      name: string
      description: string
      weight: number
      enabled?: boolean
    }

    if (!body.name || !body.description || body.weight === undefined) {
      return HttpResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const newRule = {
      name: body.name,
      description: body.description,
      weight: body.weight,
      enabled: body.enabled ?? true,
    }

    return HttpResponse.json(newRule, { status: 201 })
  }),

  http.delete(`${API_BASE}/risk/rules/:name`, async ({ params }) => {
    await delay(300)
    const { name } = params
    const rule = riskRules.find((r) => r.name === name)

    if (!rule) {
      return HttpResponse.json({ message: "Rule not found" }, { status: 404 })
    }

    return HttpResponse.json({ message: "Rule deleted successfully" })
  }),

  // ============ Graph Handlers ============

  http.get(`${API_BASE}/graph/address/:address`, async ({ params }) => {
    await delay(400)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    return HttpResponse.json(generateGraphAddressInfo(address))
  }),

  http.get(
    `${API_BASE}/graph/address/:address/neighbors`,
    async ({ params, request }) => {
      await delay(500)
      const { address } = params
      const url = new URL(request.url)
      const depth = parseInt(url.searchParams.get("depth") || "1")
      const limit = parseInt(url.searchParams.get("limit") || "50")

      if (!address || typeof address !== "string") {
        return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
      }

      return HttpResponse.json(generateNeighborsResponse(address, depth, limit))
    }
  ),

  http.get(`${API_BASE}/graph/address/:address/tags`, async ({ params }) => {
    await delay(300)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    return HttpResponse.json(randomTags())
  }),

  http.post(`${API_BASE}/graph/address/:address/tags`, async ({ params }) => {
    await delay(400)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    return HttpResponse.json(generateGraphAddressInfo(address))
  }),

  http.delete(`${API_BASE}/graph/address/:address/tags/:tag`, async () => {
    await delay(300)
    return new HttpResponse(null, { status: 200 })
  }),

  http.get(`${API_BASE}/graph/address/:address/cluster`, async ({ params }) => {
    await delay(400)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    // 60% chance of being in a cluster
    if (Math.random() > 0.4) {
      return HttpResponse.json(generateClusterResponse())
    }
    return HttpResponse.json({ message: "Address not in any cluster" }, { status: 404 })
  }),

  http.get(
    `${API_BASE}/graph/path/:fromAddress/:toAddress`,
    async ({ params, request }) => {
      await delay(600)
      const { fromAddress, toAddress } = params
      const url = new URL(request.url)
      const maxDepth = parseInt(url.searchParams.get("maxDepth") || "5")

      if (
        !fromAddress ||
        !toAddress ||
        typeof fromAddress !== "string" ||
        typeof toAddress !== "string"
      ) {
        return HttpResponse.json({ message: "Invalid addresses" }, { status: 400 })
      }

      return HttpResponse.json(generatePathResponse(fromAddress, toAddress, maxDepth))
    }
  ),

  http.get(`${API_BASE}/graph/cluster/:clusterId`, async ({ params }) => {
    await delay(400)
    const { clusterId } = params

    if (!clusterId || typeof clusterId !== "string") {
      return HttpResponse.json({ message: "Invalid cluster ID" }, { status: 400 })
    }

    return HttpResponse.json(generateClusterResponse(clusterId))
  }),

  http.post(`${API_BASE}/graph/cluster/run`, async () => {
    await delay(1000)
    return HttpResponse.json(generateClusteringResult())
  }),

  http.post(`${API_BASE}/graph/cluster/manual`, async () => {
    await delay(500)
    return HttpResponse.json(generateClusteringResult())
  }),

  http.get(`${API_BASE}/graph/search/tag/:tag`, async ({ request }) => {
    await delay(500)
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get("limit") || "50")

    return HttpResponse.json(generateHighRiskAddresses(0, Math.min(limit, 20)))
  }),

  http.get(`${API_BASE}/graph/search/high-risk`, async ({ request }) => {
    await delay(500)
    const url = new URL(request.url)
    const threshold = parseFloat(url.searchParams.get("threshold") || "0.6")
    const limit = parseInt(url.searchParams.get("limit") || "50")

    return HttpResponse.json(generateHighRiskAddresses(threshold, Math.min(limit, 30)))
  }),

  http.get(`${API_BASE}/graph/sync/status`, async () => {
    await delay(300)
    return HttpResponse.json(generateSyncStatus())
  }),

  http.post(`${API_BASE}/graph/sync`, async () => {
    await delay(500)
    return HttpResponse.json(generateSyncStatus())
  }),

  http.post(`${API_BASE}/graph/propagate`, async () => {
    await delay(800)
    return HttpResponse.json(generatePropagationResult())
  }),

  http.post(`${API_BASE}/graph/propagate/:address`, async () => {
    await delay(600)
    return HttpResponse.json(generatePropagationResult())
  }),

  // ============ Orchestration Handlers ============

  http.get(`${API_BASE}/orchestration/address-profile/:address`, async ({ params }) => {
    await delay(800)
    const { address } = params

    if (!address || typeof address !== "string") {
      return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
    }

    const analysis = generateAddressAnalysis(address)
    return HttpResponse.json({
      address: analysis.address,
      network: analysis.network,
      addressInfo: analysis.basic.addressInfo,
      riskScore: analysis.basic.riskScore,
      recentTransfers: generateTransfers(address, 10),
      orchestratedAt: Date.now(),
    })
  }),

  http.get(
    `${API_BASE}/orchestration/address-analysis/:address`,
    async ({ params, request }) => {
      await delay(1000)
      const { address } = params
      const url = new URL(request.url)
      const neighborDepth = parseInt(url.searchParams.get("neighborDepth") || "1")
      const neighborLimit = parseInt(url.searchParams.get("neighborLimit") || "20")

      if (!address || typeof address !== "string") {
        return HttpResponse.json({ message: "Invalid address" }, { status: 400 })
      }

      const analysis = generateAddressAnalysis(address)
      // Update neighbors with requested params
      analysis.graph.neighbors = generateNeighborsResponse(
        address,
        neighborDepth,
        neighborLimit
      )
      return HttpResponse.json(analysis)
    }
  ),

  http.get(
    `${API_BASE}/orchestration/connection/:fromAddress/:toAddress`,
    async ({ params, request }) => {
      await delay(1200)
      const { fromAddress, toAddress } = params
      const url = new URL(request.url)
      const maxDepth = parseInt(url.searchParams.get("maxDepth") || "5")

      if (
        !fromAddress ||
        !toAddress ||
        typeof fromAddress !== "string" ||
        typeof toAddress !== "string"
      ) {
        return HttpResponse.json({ message: "Invalid addresses" }, { status: 400 })
      }

      return HttpResponse.json(
        generateConnectionResponse(fromAddress, toAddress, maxDepth)
      )
    }
  ),

  http.get(`${API_BASE}/orchestration/high-risk-network`, async ({ request }) => {
    await delay(800)
    const url = new URL(request.url)
    const threshold = parseFloat(url.searchParams.get("threshold") || "0.7")
    const limit = parseInt(url.searchParams.get("limit") || "20")

    return HttpResponse.json(generateHighRiskNetworkResponse(threshold, limit))
  }),

  http.post(`${API_BASE}/orchestration/batch-risk-analysis`, async ({ request }) => {
    await delay(1000)
    const body = (await request.json()) as { addresses: string[]; network?: string }

    if (!body.addresses || !Array.isArray(body.addresses)) {
      return HttpResponse.json(
        { message: "Addresses array is required" },
        { status: 400 }
      )
    }

    return HttpResponse.json(generateBatchRiskScores(body.addresses))
  }),

  // ============ Admin Handlers ============

  http.get(`${API_BASE}/admin/services`, async () => {
    await delay(300)
    return HttpResponse.json(generateServicesInfo())
  }),

  http.get(`${API_BASE}/admin/services/:serviceName`, async ({ params }) => {
    await delay(300)
    const { serviceName } = params

    if (!serviceName || typeof serviceName !== "string") {
      return HttpResponse.json({ message: "Invalid service name" }, { status: 400 })
    }

    // Generate mock instances for the service
    const instanceCount = Math.floor(Math.random() * 3) + 1
    const instances = Array.from({ length: instanceCount }, (_, i) => ({
      instanceId: `192.168.1.${10 + i}:8080`,
      ip: `192.168.1.${10 + i}`,
      port: 8080,
      healthy: Math.random() > 0.2, // 80% healthy
      metadata: {
        version: "1.0.0",
        zone: "default",
      },
    }))

    return HttpResponse.json(instances)
  }),

  http.get(`${API_BASE}/admin/pipeline/status`, async () => {
    await delay(300)
    return HttpResponse.json(generatePipelineStatus())
  }),

  http.post(`${API_BASE}/admin/pipeline/ingestion/:action`, async ({ params }) => {
    await delay(400)
    const { action } = params

    if (!["pause", "resume", "trigger"].includes(action as string)) {
      return HttpResponse.json({ message: "Invalid action" }, { status: 400 })
    }

    return HttpResponse.json({
      status: "success",
      message: `Data ingestion ${action}d successfully`,
    })
  }),

  http.post(`${API_BASE}/admin/pipeline/graph-sync/:action`, async ({ params }) => {
    await delay(400)
    const { action } = params

    if (!["pause", "resume", "trigger"].includes(action as string)) {
      return HttpResponse.json({ message: "Invalid action" }, { status: 400 })
    }

    return HttpResponse.json({
      status: "success",
      message: `Graph sync ${action}d successfully`,
    })
  }),

  http.get(`${API_BASE}/admin/config/all`, async () => {
    await delay(300)
    return HttpResponse.json({
      risk: generateRiskConfig(),
      pipeline: generatePipelineConfig(),
    })
  }),

  http.get(`${API_BASE}/admin/config/risk`, async () => {
    await delay(200)
    return HttpResponse.json(generateRiskConfig())
  }),

  http.get(`${API_BASE}/admin/config/pipeline`, async () => {
    await delay(300)
    return HttpResponse.json(generatePipelineConfig())
  }),
]
