import api from "./api"
import type { AddressInfo, AddressStats, Transfer, PaginatedResponse } from "@/types"

export interface TransferQuery {
  page?: number
  pageSize?: number
  network?: string
  transferType?: string
  startTime?: string
  endTime?: string
}

export const addressService = {
  getAddressInfo: async (address: string, network = "ethereum"): Promise<AddressInfo> => {
    const response = await api.get<AddressInfo>(`/addresses/${address}`, {
      params: { network },
    })
    return response.data
  },

  getAddressTransfers: async (
    address: string,
    query: TransferQuery = {}
  ): Promise<PaginatedResponse<Transfer>> => {
    const response = await api.get<PaginatedResponse<Transfer>>(
      `/addresses/${address}/transfers`,
      { params: query }
    )
    return response.data
  },

  getAddressStats: async (
    address: string,
    network = "ethereum"
  ): Promise<AddressStats> => {
    const response = await api.get<AddressStats>(`/addresses/${address}/stats`, {
      params: { network },
    })
    return response.data
  },
}
