/**
 * Alert API hooks for BFF Alert endpoints
 * Manual implementation pending orval generation
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { customInstance } from "../../../axios-instance"

// ==================== Types ====================

export type Severity = "low" | "medium" | "high" | "critical"
export type AlertStatus = "pending" | "sent" | "failed" | "acknowledged"
export type ChannelType = "email" | "webhook" | "slack" | "telegram"
export type RuleType =
  | "risk_score"
  | "transaction_value"
  | "tag_match"
  | "graph_pattern"
  | "velocity"
  | "cluster_risk"

export interface AlertRule {
  id: number
  name: string
  description: string
  ruleType: RuleType
  conditions: Record<string, unknown>
  severity: Severity
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AlertHistory {
  id: number
  ruleId?: number
  alertType: string
  severity: Severity
  entityType: string
  entityId: string
  title: string
  message: string
  metadata: Record<string, unknown>
  status: AlertStatus
  notifiedAt?: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  createdAt: string
}

export interface AlertStats {
  total: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  byType: Record<string, number>
  averagePerHour: number
}

export interface AlertSubscription {
  id: number
  userId: string
  ruleId?: number
  channelType: ChannelType
  channelConfig: Record<string, unknown>
  enabled: boolean
  createdAt: string
}

export interface CreateAlertRuleDto {
  name: string
  description?: string
  ruleType: RuleType
  conditions: Record<string, unknown>
  severity: Severity
  enabled?: boolean
}

export interface UpdateAlertRuleDto {
  name?: string
  description?: string
  ruleType?: RuleType
  conditions?: Record<string, unknown>
  severity?: Severity
  enabled?: boolean
}

export interface AlertHistoryQuery {
  ruleId?: number
  entityType?: string
  severity?: Severity
  status?: AlertStatus
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface AlertHistoryListResponse {
  data: AlertHistory[]
  total: number
  limit: number
  offset: number
}

export interface CreateSubscriptionDto {
  userId?: string
  ruleId?: number
  channelType: ChannelType
  channelConfig: Record<string, unknown>
  enabled?: boolean
}

export interface TestAlertDto {
  channelType: ChannelType
  channelConfig: Record<string, unknown>
  message?: string
}

// ==================== Query Keys ====================

export const alertKeys = {
  all: ["alerts"] as const,
  rules: () => [...alertKeys.all, "rules"] as const,
  rulesList: (enabled?: boolean) => [...alertKeys.rules(), { enabled }] as const,
  ruleDetail: (id: number) => [...alertKeys.rules(), id] as const,
  history: () => [...alertKeys.all, "history"] as const,
  historyList: (query: AlertHistoryQuery) => [...alertKeys.history(), query] as const,
  historyDetail: (id: number) => [...alertKeys.history(), id] as const,
  stats: (hours?: number) => [...alertKeys.all, "stats", { hours }] as const,
  subscriptions: () => [...alertKeys.all, "subscriptions"] as const,
}

// ==================== Alert Rules API ====================

export const listAlertRules = (enabled?: boolean) =>
  customInstance<AlertRule[]>({
    url: "/api/v1/alerts/rules",
    method: "GET",
    params: enabled !== undefined ? { enabled } : undefined,
  })

export const useListAlertRules = (enabled?: boolean) =>
  useQuery({
    queryKey: alertKeys.rulesList(enabled),
    queryFn: () => listAlertRules(enabled),
  })

export const getAlertRule = (id: number) =>
  customInstance<AlertRule>({
    url: `/api/v1/alerts/rules/${id}`,
    method: "GET",
  })

export const useGetAlertRule = (id: number) =>
  useQuery({
    queryKey: alertKeys.ruleDetail(id),
    queryFn: () => getAlertRule(id),
    enabled: id > 0,
  })

export const createAlertRule = (data: CreateAlertRuleDto) =>
  customInstance<AlertRule>({
    url: "/api/v1/alerts/rules",
    method: "POST",
    data,
  })

export const useCreateAlertRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() })
    },
  })
}

export const updateAlertRule = (id: number, data: UpdateAlertRuleDto) =>
  customInstance<AlertRule>({
    url: `/api/v1/alerts/rules/${id}`,
    method: "PUT",
    data,
  })

export const useUpdateAlertRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAlertRuleDto }) =>
      updateAlertRule(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.ruleDetail(id) })
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() })
    },
  })
}

export const deleteAlertRule = (id: number) =>
  customInstance<{ message: string }>({
    url: `/api/v1/alerts/rules/${id}`,
    method: "DELETE",
  })

export const useDeleteAlertRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() })
    },
  })
}

export const enableAlertRule = (id: number) =>
  customInstance<AlertRule>({
    url: `/api/v1/alerts/rules/${id}/enable`,
    method: "POST",
  })

export const useEnableAlertRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: enableAlertRule,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.ruleDetail(id) })
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() })
    },
  })
}

export const disableAlertRule = (id: number) =>
  customInstance<AlertRule>({
    url: `/api/v1/alerts/rules/${id}/disable`,
    method: "POST",
  })

export const useDisableAlertRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: disableAlertRule,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.ruleDetail(id) })
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() })
    },
  })
}

// ==================== Alert History API ====================

export const listAlertHistory = (query: AlertHistoryQuery = {}) =>
  customInstance<AlertHistoryListResponse>({
    url: "/api/v1/alerts/history",
    method: "GET",
    params: query,
  })

export const useListAlertHistory = (query: AlertHistoryQuery = {}) =>
  useQuery({
    queryKey: alertKeys.historyList(query),
    queryFn: () => listAlertHistory(query),
  })

export const getAlertHistory = (id: number) =>
  customInstance<AlertHistory>({
    url: `/api/v1/alerts/history/${id}`,
    method: "GET",
  })

export const useGetAlertHistory = (id: number) =>
  useQuery({
    queryKey: alertKeys.historyDetail(id),
    queryFn: () => getAlertHistory(id),
    enabled: id > 0,
  })

export const acknowledgeAlert = (id: number) =>
  customInstance<AlertHistory>({
    url: `/api/v1/alerts/history/${id}/acknowledge`,
    method: "POST",
  })

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.historyDetail(id) })
      queryClient.invalidateQueries({ queryKey: alertKeys.history() })
      queryClient.invalidateQueries({ queryKey: alertKeys.stats() })
    },
  })
}

// ==================== Alert Stats API ====================

export const getAlertStats = (hours?: number) =>
  customInstance<AlertStats>({
    url: "/api/v1/alerts/stats",
    method: "GET",
    params: hours ? { hours } : undefined,
  })

export const useGetAlertStats = (hours?: number) =>
  useQuery({
    queryKey: alertKeys.stats(hours),
    queryFn: () => getAlertStats(hours),
  })

// ==================== Subscriptions API ====================

export const listSubscriptions = () =>
  customInstance<AlertSubscription[]>({
    url: "/api/v1/alerts/subscriptions",
    method: "GET",
  })

export const useListSubscriptions = () =>
  useQuery({
    queryKey: alertKeys.subscriptions(),
    queryFn: listSubscriptions,
  })

export const createSubscription = (data: CreateSubscriptionDto) =>
  customInstance<AlertSubscription>({
    url: "/api/v1/alerts/subscriptions",
    method: "POST",
    data,
  })

export const useCreateSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.subscriptions() })
    },
  })
}

export const deleteSubscription = (id: number) =>
  customInstance<{ message: string }>({
    url: `/api/v1/alerts/subscriptions/${id}`,
    method: "DELETE",
  })

export const useDeleteSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.subscriptions() })
    },
  })
}

// ==================== Test Alert API ====================

export const sendTestAlert = (data: TestAlertDto) =>
  customInstance<{ success: boolean; message: string }>({
    url: "/api/v1/alerts/test",
    method: "POST",
    data,
  })

export const useSendTestAlert = () =>
  useMutation({
    mutationFn: sendTestAlert,
  })
