import api from "./api"
import type {
  ServiceInfo,
  ServiceInstance,
  PipelineStatus,
  RiskProperties,
  PipelineProperties,
  AllConfigResponse,
} from "@/types"

/**
 * Admin API Service
 * Provides administrative endpoints for pipeline management and configuration
 */
export const adminService = {
  // ============== Service Management ==============

  /**
   * List all registered services
   */
  getServices: async (): Promise<ServiceInfo[]> => {
    const response = await api.get<ServiceInfo[]>("/admin/services")
    return response.data
  },

  /**
   * Get instances of a specific service
   */
  getServiceInstances: async (serviceName: string): Promise<ServiceInstance[]> => {
    const response = await api.get<ServiceInstance[]>(`/admin/services/${serviceName}`)
    return response.data
  },

  // ============== Pipeline Management ==============

  /**
   * Get pipeline status
   */
  getPipelineStatus: async (): Promise<PipelineStatus> => {
    const response = await api.get<PipelineStatus>("/admin/pipeline/status")
    return response.data
  },

  /**
   * Control data ingestion (pause, resume)
   */
  controlIngestion: async (
    action: "pause" | "resume"
  ): Promise<{ status: string; message: string }> => {
    const response = await api.post<{ status: string; message: string }>(
      `/admin/pipeline/ingestion/${action}`
    )
    return response.data
  },

  /**
   * Control graph sync (pause, resume, trigger)
   */
  controlGraphSync: async (
    action: "pause" | "resume" | "trigger"
  ): Promise<{ status: string; message: string }> => {
    const response = await api.post<{ status: string; message: string }>(
      `/admin/pipeline/graph-sync/${action}`
    )
    return response.data
  },

  // ============== Configuration Management ==============

  /**
   * Get all configurations
   */
  getAllConfig: async (): Promise<AllConfigResponse> => {
    const response = await api.get<AllConfigResponse>("/admin/config/all")
    return response.data
  },

  /**
   * Get risk configuration
   */
  getRiskConfig: async (): Promise<RiskProperties> => {
    const response = await api.get<RiskProperties>("/admin/config/risk")
    return response.data
  },

  /**
   * Get pipeline configuration
   */
  getPipelineConfig: async (): Promise<PipelineProperties> => {
    const response = await api.get<PipelineProperties>("/admin/config/pipeline")
    return response.data
  },
}
