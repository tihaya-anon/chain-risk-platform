import api from './api'
import type {
  RiskScore,
  RiskScoreRequest,
  BatchRiskScoreRequest,
  BatchRiskScoreResponse,
  RiskRule,
} from '@/types'

export const riskService = {
  scoreAddress: async (request: RiskScoreRequest): Promise<RiskScore> => {
    const response = await api.post<RiskScore>('/risk/score', request)
    return response.data
  },

  scoreAddressesBatch: async (request: BatchRiskScoreRequest): Promise<BatchRiskScoreResponse> => {
    const response = await api.post<BatchRiskScoreResponse>('/risk/batch', request)
    return response.data
  },

  listRules: async (): Promise<RiskRule[]> => {
    const response = await api.get<RiskRule[]>('/risk/rules')
    return response.data
  },
}
