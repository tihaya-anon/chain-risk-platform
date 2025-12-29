/**
 * MSW Request Handlers
 * Define all API endpoint mocks using MSW
 */

import { http, HttpResponse, delay } from 'msw'
import {
  generateLoginResponse,
  generateUser,
  generateAddressInfo,
  generateTransfers,
  generateAddressStats,
  generateRiskScore,
  generateBatchRiskScores,
  riskRules,
} from './data'

const API_BASE = '/api/v1'

export const handlers = [
  // ============ Auth Handlers ============
  
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as { username: string; password: string }

    // Validate credentials
    if (
      (body.username === 'admin' && body.password === 'admin123') ||
      (body.username === 'user' && body.password === 'user123')
    ) {
      const role = body.username === 'admin' ? 'admin' : 'user'
      return HttpResponse.json(generateLoginResponse(body.username, role))
    }

    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
  }),

  http.get(`${API_BASE}/auth/profile`, async ({ request }) => {
    await delay(200)
    const authHeader = request.headers.get('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Decode token to get user info
    try {
      const token = authHeader.split(' ')[1]
      const payload = JSON.parse(atob(token.split('.')[1]))
      return HttpResponse.json(generateUser(payload.username, payload.role))
    } catch {
      return HttpResponse.json({ message: 'Invalid token' }, { status: 401 })
    }
  }),

  // ============ Address Handlers ============

  http.get(`${API_BASE}/addresses/:address`, async ({ params }) => {
    await delay(400)
    const { address } = params

    if (!address || typeof address !== 'string') {
      return HttpResponse.json({ message: 'Invalid address' }, { status: 400 })
    }

    return HttpResponse.json(generateAddressInfo(address))
  }),

  http.get(`${API_BASE}/addresses/:address/transfers`, async ({ params, request }) => {
    await delay(500)
    const { address } = params
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20')

    if (!address || typeof address !== 'string') {
      return HttpResponse.json({ message: 'Invalid address' }, { status: 400 })
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

    if (!address || typeof address !== 'string') {
      return HttpResponse.json({ message: 'Invalid address' }, { status: 400 })
    }

    return HttpResponse.json(generateAddressStats())
  }),

  // ============ Risk Handlers ============

  http.post(`${API_BASE}/risk/score`, async ({ request }) => {
    await delay(600)
    const body = (await request.json()) as { address: string; network?: string }

    if (!body.address) {
      return HttpResponse.json({ message: 'Address is required' }, { status: 400 })
    }

    return HttpResponse.json(generateRiskScore(body.address))
  }),

  http.post(`${API_BASE}/risk/score/batch`, async ({ request }) => {
    await delay(800)
    const body = (await request.json()) as { addresses: string[]; network?: string }

    if (!body.addresses || !Array.isArray(body.addresses)) {
      return HttpResponse.json({ message: 'Addresses array is required' }, { status: 400 })
    }

    if (body.addresses.length > 100) {
      return HttpResponse.json(
        { message: 'Maximum 100 addresses per batch' },
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
      return HttpResponse.json({ message: 'Rule not found' }, { status: 404 })
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
      return HttpResponse.json({ message: 'Rule not found' }, { status: 404 })
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
      return HttpResponse.json({ message: 'Missing required fields' }, { status: 400 })
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
      return HttpResponse.json({ message: 'Rule not found' }, { status: 404 })
    }

    return HttpResponse.json({ message: 'Rule deleted successfully' })
  }),
]
