import api from "./api"
import type {
  GraphAddressInfo,
  AddressNeighborsResponse,
  PathResponse,
  ClusterResponse,
  AddTagRequest,
  SyncStatusResponse,
  PropagationResultResponse,
  ClusteringResultResponse,
} from "@/types"

export const graphService = {
  // ============== Address Queries ==============

  getAddressInfo: async (address: string): Promise<GraphAddressInfo> => {
    const response = await api.get<GraphAddressInfo>(`/graph/address/${address}`)
    return response.data
  },

  getAddressNeighbors: async (
    address: string,
    depth: number = 1,
    limit: number = 50
  ): Promise<AddressNeighborsResponse> => {
    const response = await api.get<AddressNeighborsResponse>(
      `/graph/address/${address}/neighbors`,
      { params: { depth, limit } }
    )
    return response.data
  },

  getAddressTags: async (address: string): Promise<string[]> => {
    const response = await api.get<string[]>(`/graph/address/${address}/tags`)
    return response.data
  },

  addAddressTags: async (
    address: string,
    request: AddTagRequest
  ): Promise<GraphAddressInfo> => {
    const response = await api.post<GraphAddressInfo>(
      `/graph/address/${address}/tags`,
      request
    )
    return response.data
  },

  removeAddressTag: async (address: string, tag: string): Promise<void> => {
    await api.delete(`/graph/address/${address}/tags/${tag}`)
  },

  getAddressCluster: async (address: string): Promise<ClusterResponse> => {
    const response = await api.get<ClusterResponse>(`/graph/address/${address}/cluster`)
    return response.data
  },

  // ============== Path Finding ==============

  findPath: async (
    fromAddress: string,
    toAddress: string,
    maxDepth: number = 5
  ): Promise<PathResponse> => {
    const response = await api.get<PathResponse>(
      `/graph/path/${fromAddress}/${toAddress}`,
      { params: { maxDepth } }
    )
    return response.data
  },

  // ============== Cluster Operations ==============

  getCluster: async (clusterId: string): Promise<ClusterResponse> => {
    const response = await api.get<ClusterResponse>(`/graph/cluster/${clusterId}`)
    return response.data
  },

  runClustering: async (): Promise<ClusteringResultResponse> => {
    const response = await api.post<ClusteringResultResponse>("/graph/cluster/run")
    return response.data
  },

  manualCluster: async (addresses: string[]): Promise<ClusteringResultResponse> => {
    const response = await api.post<ClusteringResultResponse>(
      "/graph/cluster/manual",
      addresses
    )
    return response.data
  },

  // ============== Search ==============

  searchByTag: async (tag: string, limit: number = 50): Promise<GraphAddressInfo[]> => {
    const response = await api.get<GraphAddressInfo[]>(`/graph/search/tag/${tag}`, {
      params: { limit },
    })
    return response.data
  },

  getHighRiskAddresses: async (
    threshold: number = 0.6,
    limit: number = 50
  ): Promise<GraphAddressInfo[]> => {
    const response = await api.get<GraphAddressInfo[]>("/graph/search/high-risk", {
      params: { threshold, limit },
    })
    return response.data
  },

  // ============== Sync & Propagation ==============

  getSyncStatus: async (): Promise<SyncStatusResponse> => {
    const response = await api.get<SyncStatusResponse>("/graph/sync/status")
    return response.data
  },

  triggerSync: async (): Promise<SyncStatusResponse> => {
    const response = await api.post<SyncStatusResponse>("/graph/sync")
    return response.data
  },

  propagateTags: async (): Promise<PropagationResultResponse> => {
    const response = await api.post<PropagationResultResponse>("/graph/propagate")
    return response.data
  },

  propagateFromAddress: async (address: string): Promise<PropagationResultResponse> => {
    const response = await api.post<PropagationResultResponse>(
      `/graph/propagate/${address}`
    )
    return response.data
  },
}
