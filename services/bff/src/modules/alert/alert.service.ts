import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import axios, { AxiosInstance, AxiosError } from "axios";
import { getConfig } from "../../config/config";
import { getLogger } from "../../common/logger";
import {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
  AlertRuleResponse,
  AlertHistoryQueryDto,
  AlertHistoryResponse,
  AlertHistoryListResponse,
  AlertStatsResponse,
  CreateSubscriptionDto,
  SubscriptionResponse,
  TestAlertDto,
  TestAlertResponse,
} from "./alert.dto";

const logger = getLogger("AlertService");

// Raw response types from alert-service (snake_case)
interface RawAlertRule {
  id: number;
  name: string;
  description: string;
  rule_type: string;
  severity: string;
  conditions: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface RawAlertHistory {
  id: number;
  rule_id?: number;
  alert_type: string;
  severity: string;
  entity_type: string;
  entity_id: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  status: string;
  notified_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at: string;
}

interface RawAlertStats {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  average_per_hour: number;
}

interface RawSubscription {
  id: number;
  user_id: string;
  rule_id?: number;
  channel_type: string;
  channel_config: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AlertService {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getConfig();
    this.client = axios.create({
      baseURL: config.services.alert.url,
      timeout: config.services.alert.timeout,
    });
  }

  // ==================== Alert Rules ====================

  async listRules(enabled?: boolean): Promise<AlertRuleResponse[]> {
    try {
      const params = enabled !== undefined ? { enabled } : {};
      const response = await this.client.get<{ data: RawAlertRule[] }>(
        "/api/v1/alert-rules",
        { params },
      );
      return response.data.data.map(this.transformRule);
    } catch (error) {
      this.handleError(error, "listRules");
    }
  }

  async getRule(id: number): Promise<AlertRuleResponse> {
    try {
      const response = await this.client.get<{ data: RawAlertRule }>(
        `/api/v1/alert-rules/${id}`,
      );
      return this.transformRule(response.data.data);
    } catch (error) {
      this.handleError(error, "getRule", id);
    }
  }

  async createRule(dto: CreateAlertRuleDto): Promise<AlertRuleResponse> {
    try {
      const response = await this.client.post<{ data: RawAlertRule }>(
        "/api/v1/alert-rules",
        {
          name: dto.name,
          description: dto.description || "",
          rule_type: dto.ruleType,
          severity: dto.severity,
          conditions: dto.conditions,
          enabled: dto.enabled ?? true,
        },
      );
      return this.transformRule(response.data.data);
    } catch (error) {
      this.handleError(error, "createRule");
    }
  }

  async updateRule(id: number, dto: UpdateAlertRuleDto): Promise<AlertRuleResponse> {
    try {
      const payload: Record<string, any> = {};
      if (dto.name !== undefined) payload.name = dto.name;
      if (dto.description !== undefined) payload.description = dto.description;
      if (dto.severity !== undefined) payload.severity = dto.severity;
      if (dto.conditions !== undefined) payload.conditions = dto.conditions;
      if (dto.enabled !== undefined) payload.enabled = dto.enabled;

      const response = await this.client.put<{ data: RawAlertRule }>(
        `/api/v1/alert-rules/${id}`,
        payload,
      );
      return this.transformRule(response.data.data);
    } catch (error) {
      this.handleError(error, "updateRule", id);
    }
  }

  async deleteRule(id: number): Promise<void> {
    try {
      await this.client.delete(`/api/v1/alert-rules/${id}`);
    } catch (error) {
      this.handleError(error, "deleteRule", id);
    }
  }

  async enableRule(id: number): Promise<AlertRuleResponse> {
    try {
      const response = await this.client.post<{ data: RawAlertRule }>(
        `/api/v1/alert-rules/${id}/enable`,
      );
      return this.transformRule(response.data.data);
    } catch (error) {
      this.handleError(error, "enableRule", id);
    }
  }

  async disableRule(id: number): Promise<AlertRuleResponse> {
    try {
      const response = await this.client.post<{ data: RawAlertRule }>(
        `/api/v1/alert-rules/${id}/disable`,
      );
      return this.transformRule(response.data.data);
    } catch (error) {
      this.handleError(error, "disableRule", id);
    }
  }

  // ==================== Alert History ====================

  async listHistory(query: AlertHistoryQueryDto): Promise<AlertHistoryListResponse> {
    try {
      const params: Record<string, any> = {
        page: query.page || 1,
        page_size: query.pageSize || 20,
      };
      if (query.ruleId) params.rule_id = query.ruleId;
      if (query.severity) params.severity = query.severity;
      if (query.status) params.status = query.status;
      if (query.entityId) params.entity_id = query.entityId;
      if (query.startTime) params.start_time = query.startTime;
      if (query.endTime) params.end_time = query.endTime;

      const response = await this.client.get<{
        data: RawAlertHistory[];
        total: number;
        page: number;
        page_size: number;
      }>("/api/v1/alerts", { params });

      return {
        data: response.data.data.map(this.transformHistory),
        total: response.data.total,
        page: response.data.page,
        pageSize: response.data.page_size,
      };
    } catch (error) {
      this.handleError(error, "listHistory");
    }
  }

  async getHistoryById(id: number): Promise<AlertHistoryResponse> {
    try {
      const response = await this.client.get<{ data: RawAlertHistory }>(
        `/api/v1/alerts/${id}`,
      );
      return this.transformHistory(response.data.data);
    } catch (error) {
      this.handleError(error, "getHistoryById", id);
    }
  }

  async acknowledgeAlert(id: number, userId: string): Promise<AlertHistoryResponse> {
    try {
      const response = await this.client.post<{ data: RawAlertHistory }>(
        `/api/v1/alerts/${id}/acknowledge`,
        { user_id: userId },
      );
      return this.transformHistory(response.data.data);
    } catch (error) {
      this.handleError(error, "acknowledgeAlert", id);
    }
  }

  async getStats(hours?: number): Promise<AlertStatsResponse> {
    try {
      const params = hours ? { hours } : {};
      const response = await this.client.get<{ data: RawAlertStats }>(
        "/api/v1/alerts/stats",
        { params },
      );
      const raw = response.data.data;
      return {
        total: raw.total,
        bySeverity: raw.by_severity,
        byStatus: raw.by_status,
        byType: raw.by_type,
        averagePerHour: raw.average_per_hour,
      };
    } catch (error) {
      this.handleError(error, "getStats");
    }
  }

  // ==================== Subscriptions ====================

  async listSubscriptions(userId: string): Promise<SubscriptionResponse[]> {
    try {
      const response = await this.client.get<{ data: RawSubscription[] }>(
        "/api/v1/subscriptions",
        { params: { user_id: userId } },
      );
      return response.data.data.map(this.transformSubscription);
    } catch (error) {
      this.handleError(error, "listSubscriptions");
    }
  }

  async createSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionResponse> {
    try {
      const response = await this.client.post<{ data: RawSubscription }>(
        "/api/v1/subscriptions",
        {
          user_id: dto.userId,
          rule_id: dto.ruleId,
          channel_type: dto.channelType,
          channel_config: dto.channelConfig,
          enabled: dto.enabled ?? true,
        },
      );
      return this.transformSubscription(response.data.data);
    } catch (error) {
      this.handleError(error, "createSubscription");
    }
  }

  async deleteSubscription(id: number): Promise<void> {
    try {
      await this.client.delete(`/api/v1/subscriptions/${id}`);
    } catch (error) {
      this.handleError(error, "deleteSubscription", id);
    }
  }

  // ==================== Test Alert ====================

  async sendTestAlert(dto: TestAlertDto): Promise<TestAlertResponse> {
    try {
      const response = await this.client.post<{ success: boolean; message: string }>(
        "/api/v1/test/alert",
        {
          channel_type: dto.channelType,
          channel_config: dto.channelConfig,
          message: dto.message || "Test alert from BFF",
        },
      );
      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error) {
      this.handleError(error, "sendTestAlert");
    }
  }

  // ==================== Transformers ====================

  private transformRule(raw: RawAlertRule): AlertRuleResponse {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      ruleType: raw.rule_type as any,
      severity: raw.severity as any,
      conditions: raw.conditions,
      enabled: raw.enabled,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  private transformHistory(raw: RawAlertHistory): AlertHistoryResponse {
    return {
      id: raw.id,
      ruleId: raw.rule_id,
      alertType: raw.alert_type,
      severity: raw.severity as any,
      entityType: raw.entity_type,
      entityId: raw.entity_id,
      title: raw.title,
      message: raw.message,
      metadata: raw.metadata,
      status: raw.status as any,
      notifiedAt: raw.notified_at,
      acknowledgedAt: raw.acknowledged_at,
      acknowledgedBy: raw.acknowledged_by,
      createdAt: raw.created_at,
    };
  }

  private transformSubscription(raw: RawSubscription): SubscriptionResponse {
    return {
      id: raw.id,
      userId: raw.user_id,
      ruleId: raw.rule_id,
      channelType: raw.channel_type as any,
      channelConfig: raw.channel_config,
      enabled: raw.enabled,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  // ==================== Error Handling ====================

  private handleError(error: unknown, method: string, id?: number): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = (axiosError.response?.data as any)?.error || axiosError.message;

      logger.error(`${method} failed`, { id, status, message });
      throw new HttpException(message, status);
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`${method} unexpected error`, { id, error: errorMessage });
    throw new HttpException("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
