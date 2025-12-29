import api, { isMockMode } from './api'
import {
  mockGetAddressInfo,
  mockGetAddressTransfers,
  mockGetAddressStats,
} from './mock'
import type { AddressInfo, AddressStats, Transfer, PaginatedResponse } from '@/types'

export interface TransferQuery {
  page?: number
  pageSize?: number
  network?: string
  transferType?: string
  startTime?: string
  endTime?: string
}

export const addressService = {
  getAddressInfo: async (address: string, network = 'ethereum'): Promise<AddressInfo> => {
    try {
      const response = await api.get<AddressInfo>(`/addresses/${address}`, {
        params: { network },
      })
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] addressService.getAddressInfo', address)
        return mockGetAddressInfo(address)
      }
      throw error
    }
  },

  getAddressTransfers: async (
    address: string,
    query: TransferQuery = {}
  ): Promise<PaginatedResponse<Transfer>> => {
    try {
      const response = await api.get<PaginatedResponse<Transfer>>(
        `/addresses/${address}/transfers`,
        { params: query }
      )
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] addressService.getAddressTransfers', address)
        return mockGetAddressTransfers(address)
      }
      throw error
    }
  },

  getAddressStats: async (address: string, network = 'ethereum'): Promise<AddressStats> => {
    try {
      const response = await api.get<AddressStats>(`/addresses/${address}/stats`, {
        params: { network },
      })
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] addressService.getAddressStats', address)
        return mockGetAddressStats()
      }
      throw error
    }
  },
}
