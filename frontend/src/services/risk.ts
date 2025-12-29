import api, { isMockMode } from './api'
import { mockScoreAddress, mockScoreAddressesBatch, mockListRules } from './mock'
import type {
  RiskScore,
  RiskScoreRequest,
  BatchRiskScoreRequest,
  BatchRiskScoreResponse,
  RiskRule,
} from '@/types'

export const riskService = {
  scoreAddress: async (request: RiskScoreRequest): Promise<RiskScore> => {
    try {
      const response = await api.post<RiskScore>('/risk/score', request)
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] riskService.scoreAddress', request.address)
        return mockScoreAddress(request.address)
      }
      throw error
    }
  },

  scoreAddressesBatch: async (request: BatchRiskScoreRequest): Promise<BatchRiskScoreResponse> => {
    try {
      const response = await api.post<BatchRiskScoreResponse>('/risk/batch', request)
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] riskService.scoreAddressesBatch', request.addresses.length)
        return mockScoreAddressesBatch(request.addresses)
      }
      throw error
    }
  },

  listRules: async (): Promise<RiskRule[]> => {
    try {
      const response = await api.get<RiskRule[]>('/risk/rules')
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] riskService.listRules')
        return mockListRules()
      }
      throw error
    }
  },
}
