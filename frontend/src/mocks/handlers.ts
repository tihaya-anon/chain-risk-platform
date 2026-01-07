/**
 * MSW Request Handlers
 * Custom handlers with authentication logic + auto-generated handlers from OpenAPI specs
 */

import { http, HttpResponse, delay } from "msw"
import { getAddressesMock } from "@/api/generated/bff/addresses/addresses.msw"
import { getGraphMock } from "@/api/generated/bff/graph/graph.msw"
import { getRiskMock } from "@/api/generated/bff/risk/risk.msw"
import { getTransfersMock } from "@/api/generated/bff/transfers/transfers.msw"
import { getAdminApiMock } from "@/api/generated/orchestrator/admin-api/admin-api.msw"
import { getOrchestrationMock } from "@/api/generated/orchestrator/orchestration/orchestration.msw"

// Demo accounts configuration
const DEMO_ACCOUNTS: Record<string, { password: string; role: "admin" | "user"; id: string }> = {
  admin: { password: "admin123", role: "admin", id: "1" },
  user: { password: "user123", role: "user", id: "2" },
}

// Simple JWT-like token generator (base64 encoded, not cryptographically secure - for demo only)
function generateMockToken(payload: { sub: string; username: string; role: string }): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 }))
  const signature = btoa("mock-signature")
  return `${header}.${body}.${signature}`
}

// Custom login handler with credential validation
const loginHandler = http.post("*/api/v1/auth/login", async ({ request }) => {
  await delay(300)

  const body = (await request.json()) as { username: string; password: string }
  const { username, password } = body

  const account = DEMO_ACCOUNTS[username]

  if (!account || account.password !== password) {
    return new HttpResponse(JSON.stringify({ message: "Invalid username or password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const token = generateMockToken({
    sub: account.id,
    username,
    role: account.role,
  })

  return HttpResponse.json({
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: "24h",
  })
})

// Custom profile handler that extracts user from Authorization header
const profileHandler = http.get("*/api/v1/auth/profile", async ({ request }) => {
  await delay(200)

  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new HttpResponse(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const token = authHeader.slice(7)
    const payload = JSON.parse(atob(token.split(".")[1]))
    return HttpResponse.json({
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    })
  } catch {
    return new HttpResponse(JSON.stringify({ message: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
})

// Combine custom auth handlers with generated handlers
export const handlers = [
  // Custom auth handlers (override generated ones)
  loginHandler,
  profileHandler,

  // Generated handlers from OpenAPI specs
  ...getAddressesMock(),
  ...getGraphMock(),
  ...getRiskMock(),
  ...getTransfersMock(),
  ...getAdminApiMock(),
  ...getOrchestrationMock(),
]
