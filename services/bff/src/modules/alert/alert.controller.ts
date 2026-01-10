import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AlertService } from "./alert.service";
import {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
  AlertRuleResponse,
  AlertHistoryQueryDto,
  AlertHistoryListResponse,
  AlertHistoryResponse,
  AlertStatsResponse,
  CreateSubscriptionDto,
  SubscriptionResponse,
  TestAlertDto,
  TestAlertResponse,
} from "./alert.dto";
import { GatewayAuthGuard, RolesGuard } from "../../common/guards";
import { GatewayUser, Roles } from "../../common/decorators";
import { UserPayload } from "../auth/auth.dto";
import { getLogger } from "../../common/logger";

const logger = getLogger("AlertController");

@ApiTags("alerts")
@Controller("alerts")
@UseGuards(GatewayAuthGuard, RolesGuard)
@ApiHeader({ name: "X-User-Id", description: "User ID (from Gateway)", required: true })
@ApiHeader({ name: "X-User-Username", description: "Username (from Gateway)", required: true })
@ApiHeader({ name: "X-User-Role", description: "User role (from Gateway)", required: true })
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  // ==================== Alert Rules ====================

  @Get("rules")
  @Roles("user")
  @ApiOperation({ summary: "List alert rules" })
  @ApiQuery({ name: "enabled", required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [AlertRuleResponse] })
  async listRules(
    @Query("enabled") enabled?: boolean,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertRuleResponse[]> {
    logger.debug("Listing alert rules", { userId: user?.sub, enabled });
    return this.alertService.listRules(enabled);
  }

  @Get("rules/:id")
  @Roles("user")
  @ApiOperation({ summary: "Get alert rule by ID" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: AlertRuleResponse })
  @ApiResponse({ status: 404, description: "Rule not found" })
  async getRule(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertRuleResponse> {
    logger.debug("Getting alert rule", { userId: user?.sub, ruleId: id });
    return this.alertService.getRule(id);
  }

  @Post("rules")
  @Roles("analyst")
  @ApiOperation({ summary: "Create alert rule (analyst+)" })
  @ApiResponse({ status: 201, type: AlertRuleResponse })
  @ApiResponse({ status: 400, description: "Invalid request" })
  @ApiResponse({ status: 403, description: "Forbidden - requires analyst role" })
  async createRule(
    @Body() dto: CreateAlertRuleDto,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertRuleResponse> {
    logger.info("Creating alert rule", { userId: user?.sub, name: dto.name });
    return this.alertService.createRule(dto);
  }

  @Put("rules/:id")
  @Roles("analyst")
  @ApiOperation({ summary: "Update alert rule (analyst+)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: AlertRuleResponse })
  @ApiResponse({ status: 403, description: "Forbidden - requires analyst role" })
  @ApiResponse({ status: 404, description: "Rule not found" })
  async updateRule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAlertRuleDto,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertRuleResponse> {
    logger.info("Updating alert rule", { userId: user?.sub, ruleId: id });
    return this.alertService.updateRule(id, dto);
  }

  @Delete("rules/:id")
  @Roles("admin")
  @ApiOperation({ summary: "Delete alert rule (admin only)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Rule deleted" })
  @ApiResponse({ status: 403, description: "Forbidden - requires admin role" })
  @ApiResponse({ status: 404, description: "Rule not found" })
  async deleteRule(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user?: UserPayload,
  ): Promise<{ message: string }> {
    logger.info("Deleting alert rule", { userId: user?.sub, ruleId: id });
    await this.alertService.deleteRule(id);
    return { message: "Rule deleted" };
  }

  @Post("rules/:id/enable")
  @Roles("analyst")
  @ApiOperation({ summary: "Enable alert rule (analyst+)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: AlertRuleResponse })
  @ApiResponse({ status: 403, description: "Forbidden - requires analyst role" })
  async enableRule(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertRuleResponse> {
    logger.info("Enabling alert rule", { userId: user?.sub, ruleId: id });
    return this.alertService.enableRule(id);
  }

  @Post("rules/:id/disable")
  @Roles("analyst")
  @ApiOperation({ summary: "Disable alert rule (analyst+)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: AlertRuleResponse })
  @ApiResponse({ status: 403, description: "Forbidden - requires analyst role" })
  async disableRule(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertRuleResponse> {
    logger.info("Disabling alert rule", { userId: user?.sub, ruleId: id });
    return this.alertService.disableRule(id);
  }

  // ==================== Alert History ====================

  @Get("history")
  @Roles("user")
  @ApiOperation({ summary: "List alert history" })
  @ApiResponse({ status: 200, type: AlertHistoryListResponse })
  async listHistory(
    @Query() query: AlertHistoryQueryDto,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertHistoryListResponse> {
    logger.debug("Listing alert history", { userId: user?.sub, query });
    return this.alertService.listHistory(query);
  }

  @Get("history/:id")
  @Roles("user")
  @ApiOperation({ summary: "Get alert by ID" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: AlertHistoryResponse })
  @ApiResponse({ status: 404, description: "Alert not found" })
  async getHistoryById(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertHistoryResponse> {
    logger.debug("Getting alert", { userId: user?.sub, alertId: id });
    return this.alertService.getHistoryById(id);
  }

  @Post("history/:id/acknowledge")
  @Roles("analyst")
  @ApiOperation({ summary: "Acknowledge alert (analyst+)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, type: AlertHistoryResponse })
  @ApiResponse({ status: 403, description: "Forbidden - requires analyst role" })
  async acknowledgeAlert(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user: UserPayload,
  ): Promise<AlertHistoryResponse> {
    logger.info("Acknowledging alert", { userId: user.sub, alertId: id });
    return this.alertService.acknowledgeAlert(id, user.sub);
  }

  @Get("stats")
  @Roles("user")
  @ApiOperation({ summary: "Get alert statistics" })
  @ApiQuery({ name: "hours", required: false, type: Number, description: "Hours to look back (default: 24)" })
  @ApiResponse({ status: 200, type: AlertStatsResponse })
  async getStats(
    @Query("hours") hours?: number,
    @GatewayUser() user?: UserPayload,
  ): Promise<AlertStatsResponse> {
    logger.debug("Getting alert stats", { userId: user?.sub, hours });
    return this.alertService.getStats(hours);
  }

  // ==================== Subscriptions ====================

  @Get("subscriptions")
  @Roles("user")
  @ApiOperation({ summary: "List user subscriptions" })
  @ApiResponse({ status: 200, type: [SubscriptionResponse] })
  async listSubscriptions(
    @GatewayUser() user: UserPayload,
  ): Promise<SubscriptionResponse[]> {
    logger.debug("Listing subscriptions", { userId: user.sub });
    return this.alertService.listSubscriptions(user.sub);
  }

  @Post("subscriptions")
  @Roles("user")
  @ApiOperation({ summary: "Create subscription" })
  @ApiResponse({ status: 201, type: SubscriptionResponse })
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @GatewayUser() user: UserPayload,
  ): Promise<SubscriptionResponse> {
    dto.userId = user.sub;
    logger.info("Creating subscription", { userId: user.sub, channelType: dto.channelType });
    return this.alertService.createSubscription(dto);
  }

  @Delete("subscriptions/:id")
  @Roles("user")
  @ApiOperation({ summary: "Delete subscription" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Subscription deleted" })
  async deleteSubscription(
    @Param("id", ParseIntPipe) id: number,
    @GatewayUser() user: UserPayload,
  ): Promise<{ message: string }> {
    logger.info("Deleting subscription", { userId: user.sub, subscriptionId: id });
    await this.alertService.deleteSubscription(id);
    return { message: "Subscription deleted" };
  }

  // ==================== Test ====================

  @Post("test")
  @Roles("analyst")
  @ApiOperation({ summary: "Send test alert (analyst+)" })
  @ApiResponse({ status: 200, type: TestAlertResponse })
  @ApiResponse({ status: 403, description: "Forbidden - requires analyst role" })
  async sendTestAlert(
    @Body() dto: TestAlertDto,
    @GatewayUser() user: UserPayload,
  ): Promise<TestAlertResponse> {
    logger.info("Sending test alert", { userId: user.sub, channelType: dto.channelType });
    return this.alertService.sendTestAlert(dto);
  }
}
