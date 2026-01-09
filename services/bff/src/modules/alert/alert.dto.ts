import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsEnum,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

// Enums
export enum AlertRuleType {
  RISK_SCORE = "risk_score",
  TRANSACTION_VALUE = "transaction_value",
  TAG_MATCH = "tag_match",
  VELOCITY = "velocity",
  CLUSTER_RISK = "cluster_risk",
}

export enum AlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum AlertStatus {
  PENDING = "pending",
  SENT = "sent",
  ACKNOWLEDGED = "acknowledged",
  RESOLVED = "resolved",
}

export enum ChannelType {
  EMAIL = "email",
  WEBHOOK = "webhook",
  SLACK = "slack",
  TELEGRAM = "telegram",
}

// Alert Rule DTOs
export class CreateAlertRuleDto {
  @ApiProperty({ description: "Rule name" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: "Rule description" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AlertRuleType, description: "Rule type" })
  @IsEnum(AlertRuleType)
  ruleType: AlertRuleType;

  @ApiProperty({ enum: AlertSeverity, description: "Alert severity" })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiProperty({ description: "Rule conditions (JSON)", type: Object })
  @IsObject()
  conditions: Record<string, any>;

  @ApiPropertyOptional({ description: "Enable rule", default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateAlertRuleDto {
  @ApiPropertyOptional({ description: "Rule name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: "Rule description" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: AlertSeverity, description: "Alert severity" })
  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @ApiPropertyOptional({ description: "Rule conditions (JSON)", type: Object })
  @IsObject()
  @IsOptional()
  conditions?: Record<string, any>;

  @ApiPropertyOptional({ description: "Enable rule" })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class AlertRuleResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: AlertRuleType })
  ruleType: AlertRuleType;

  @ApiProperty({ enum: AlertSeverity })
  severity: AlertSeverity;

  @ApiProperty({ type: Object })
  conditions: Record<string, any>;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

// Alert History DTOs
export class AlertHistoryQueryDto {
  @ApiPropertyOptional({ description: "Filter by rule ID" })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  ruleId?: number;

  @ApiPropertyOptional({ enum: AlertSeverity, description: "Filter by severity" })
  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @ApiPropertyOptional({ enum: AlertStatus, description: "Filter by status" })
  @IsEnum(AlertStatus)
  @IsOptional()
  status?: AlertStatus;

  @ApiPropertyOptional({ description: "Filter by entity ID (address/tx)" })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: "Start time (ISO 8601)" })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: "End time (ISO 8601)" })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Page size", default: 20 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;
}

export class AlertHistoryResponse {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  ruleId?: number;

  @ApiProperty()
  alertType: string;

  @ApiProperty({ enum: AlertSeverity })
  severity: AlertSeverity;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: Object })
  metadata: Record<string, any>;

  @ApiProperty({ enum: AlertStatus })
  status: AlertStatus;

  @ApiPropertyOptional()
  notifiedAt?: string;

  @ApiPropertyOptional()
  acknowledgedAt?: string;

  @ApiPropertyOptional()
  acknowledgedBy?: string;

  @ApiProperty()
  createdAt: string;
}

export class AlertHistoryListResponse {
  @ApiProperty({ type: [AlertHistoryResponse] })
  data: AlertHistoryResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

// Alert Stats DTOs
export class AlertStatsResponse {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: Object, description: "Count by severity" })
  bySeverity: Record<string, number>;

  @ApiProperty({ type: Object, description: "Count by status" })
  byStatus: Record<string, number>;

  @ApiProperty({ type: Object, description: "Count by type" })
  byType: Record<string, number>;

  @ApiProperty()
  averagePerHour: number;
}

// Subscription DTOs
export class CreateSubscriptionDto {
  @ApiProperty({ description: "User ID" })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: "Rule ID (null for all rules)" })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  ruleId?: number;

  @ApiProperty({ enum: ChannelType, description: "Notification channel" })
  @IsEnum(ChannelType)
  channelType: ChannelType;

  @ApiProperty({ description: "Channel config (email, webhook url, etc)", type: Object })
  @IsObject()
  channelConfig: Record<string, any>;

  @ApiPropertyOptional({ description: "Enable subscription", default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class SubscriptionResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  ruleId?: number;

  @ApiProperty({ enum: ChannelType })
  channelType: ChannelType;

  @ApiProperty({ type: Object })
  channelConfig: Record<string, any>;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

// Test Alert DTOs
export class TestAlertDto {
  @ApiProperty({ enum: ChannelType, description: "Channel to test" })
  @IsEnum(ChannelType)
  channelType: ChannelType;

  @ApiProperty({ description: "Channel config", type: Object })
  @IsObject()
  channelConfig: Record<string, any>;

  @ApiPropertyOptional({ description: "Test message" })
  @IsString()
  @IsOptional()
  message?: string;
}

export class TestAlertResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
