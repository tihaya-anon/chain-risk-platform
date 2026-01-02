import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { RiskService } from "./risk.service";
import {
  RiskScoreRequestDto,
  BatchRiskScoreRequestDto,
  RiskScoreResponse,
  BatchRiskScoreResponse,
  RiskRule,
} from "./risk.dto";
import { GatewayAuthGuard } from "../../common/guards";
import { GatewayUser } from "../../common/decorators/gateway-user.decorator";
import { UserPayload } from "../auth/auth.dto";
import { getLogger } from "../../common/logger";

const logger = getLogger("RiskController");

@ApiTags("risk")
@Controller("risk")
@UseGuards(GatewayAuthGuard)
@ApiHeader({
  name: "X-User-Id",
  description: "User ID (provided by Gateway)",
  required: true,
})
@ApiHeader({
  name: "X-User-Username",
  description: "Username (provided by Gateway)",
  required: true,
})
@ApiHeader({
  name: "X-User-Role",
  description: "User role (provided by Gateway)",
  required: true,
})
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post("score")
  @ApiOperation({ summary: "Calculate risk score for an address" })
  @ApiResponse({
    status: 200,
    description: "Risk score calculated",
    type: RiskScoreResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async scoreAddress(
    @Body() dto: RiskScoreRequestDto,
    @GatewayUser() user: UserPayload,
  ): Promise<RiskScoreResponse> {
    logger.debug("Scoring address", { address: dto.address, userId: user.sub });
    return this.riskService.scoreAddress(dto);
  }

  @Post("score/batch")
  @ApiOperation({ summary: "Calculate risk scores for multiple addresses" })
  @ApiResponse({
    status: 200,
    description: "Risk scores calculated",
    type: BatchRiskScoreResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async scoreAddressesBatch(
    @Body() dto: BatchRiskScoreRequestDto,
    @GatewayUser() user: UserPayload,
  ): Promise<BatchRiskScoreResponse> {
    logger.debug("Batch scoring addresses", {
      count: dto.addresses.length,
      userId: user.sub,
    });
    return this.riskService.scoreAddressesBatch(dto);
  }

  @Get("rules")
  @ApiOperation({ summary: "Get all risk rules" })
  @ApiResponse({
    status: 200,
    description: "Risk rules list",
    type: [RiskRule],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  async listRules(@GatewayUser() user: UserPayload): Promise<RiskRule[]> {
    logger.debug("Listing risk rules", { userId: user.sub });
    return this.riskService.listRules();
  }
}
