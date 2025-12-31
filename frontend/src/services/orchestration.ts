import api from './api'
import type {
  AddressProfile,
  AddressAnalysis,
  ConnectionResponse,
  HighRiskNetworkResponse,
} from '@/types'

export const orchestrationService = {
  /**
   * Get basic address profile (address info + risk + transfers)
   */
  getAddressProfile: async (
    address: string,
    network: string = 'ethereum'
  ): Promise<AddressProfile> => {
    const response = await api.get<AddressProfile>(
      `/orchestration/address-profile/${address}`,
      { params: { network } }
    )
    return response.data
  },

  /**
   * Get comprehensive address analysis (includes graph data)
   */
  getAddressAnalysis: async (
    address: string,
    options: {
      network?: string
      neighborDepth?: number
      neighborLimit?: number
    } = {}
  ): Promise<AddressAnalysis> => {
    const {
      network = 'ethereum',
      neighborDepth = 1,
      neighborLimit = 20,
    } = options
    const response = await api.get<AddressAnalysis>(
      `/orchestration/address-analysis/${address}`,
      { params: { network, neighborDepth, neighborLimit } }
    )
    return response.data
  },

  /**
   * Find connection between two addresses
   */
  findConnection: async (
    fromAddress: string,
    toAddress: string,
    options: {
      maxDepth?: number
      network?: string
    } = {}
  ): Promise<ConnectionResponse> => {
    const { maxDepth = 5, network = 'ethereum' } = options
    const response = await api.get<ConnectionResponse>(
      `/orchestration/connection/${fromAddress}/${toAddress}`,
      { params: { maxDepth, network } }
    )
    return response.data
  },

  /**
   * Get high-risk network
   */
  getHighRiskNetwork: async (
    threshold: number = 0.7,
    limit: number = 20
  ): Promise<HighRiskNetworkResponse> => {
    const response = await api.get<HighRiskNetworkResponse>(
      '/orchestration/high-risk-network',
      { params: { threshold, limit } }
    )
    return response.data
  },

  /**
   * Batch risk analysis
   */
  batchRiskAnalysis: async (
    addresses: string[],
    network: string = 'ethereum'
  ): Promise<{ results: unknown[]; total: number; failed: number }> => {
    const response = await api.post('/orchestration/batch-risk-analysis', {
      addresses,
      network,
    })
    return response.data
  },
}
