import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { OrchestrationService } from "./orchestration.service";
import {
  AddressProfileQueryDto,
  AddressAnalysisQueryDto,
  ConnectionQueryDto,
  HighRiskNetworkQueryDto,
  AddressProfileResponse,
  AddressAnalysisResponse,
  ConnectionResponse,
  HighRiskNetworkResponse,
} from "./orchestration.dto";
import { GatewayAuthGuard } from "../../common/guards/gateway-auth.guard";

@ApiTags("orchestration")
@Controller("api/v1/orchestration")
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
export class OrchestrationController {
  constructor(private readonly orchestrationService: OrchestrationService) {}

  @Get("address-profile/:address")
  @ApiOperation({
    summary: "Get address profile",
    description: "Aggregates address info, risk score, and recent transfers in parallel",
  })
  @ApiParam({ name: "address", description: "Blockchain address" })
  @ApiResponse({ status: 200, description: "Success", type: AddressProfileResponse })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing Gateway headers" })
  async getAddressProfile(
    @Param("address") address: string,
    @Query() query: AddressProfileQueryDto,
  ): Promise<AddressProfileResponse> {
    return this.orchestrationService.getAddressProfile(
      address,
      query.network || "ethereum",
    );
  }

  @Get("address-analysis/:address")
  @ApiOperation({
    summary: "Get address analysis",
    description: "Full analysis: address info, risk score, graph data, and alerts",
  })
  @ApiParam({ name: "address", description: "Blockchain address" })
  @ApiResponse({ status: 200, description: "Success", type: AddressAnalysisResponse })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing Gateway headers" })
  async getAddressAnalysis(
    @Param("address") address: string,
    @Query() query: AddressAnalysisQueryDto,
  ): Promise<AddressAnalysisResponse> {
    return this.orchestrationService.getAddressAnalysis(
      address,
      query.network || "ethereum",
      query.neighborDepth || 1,
      query.neighborLimit || 20,
    );
  }

  @Get("connection/:fromAddress/:toAddress")
  @ApiOperation({
    summary: "Find connection between addresses",
    description: "Finds shortest path and enriches with risk scores",
  })
  @ApiParam({ name: "fromAddress", description: "Source address" })
  @ApiParam({ name: "toAddress", description: "Target address" })
  @ApiResponse({ status: 200, description: "Success", type: ConnectionResponse })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing Gateway headers" })
  async findConnection(
    @Param("fromAddress") fromAddress: string,
    @Param("toAddress") toAddress: string,
    @Query() query: ConnectionQueryDto,
  ): Promise<ConnectionResponse> {
    return this.orchestrationService.findConnection(
      fromAddress,
      toAddress,
      query.maxDepth || 5,
      query.network || "ethereum",
    );
  }

  @Get("high-risk-network")
  @ApiOperation({
    summary: "Get high-risk network",
    description: "Returns addresses above risk threshold",
  })
  @ApiResponse({ status: 200, description: "Success", type: HighRiskNetworkResponse })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing Gateway headers" })
  async getHighRiskNetwork(
    @Query() query: HighRiskNetworkQueryDto,
  ): Promise<HighRiskNetworkResponse> {
    return this.orchestrationService.getHighRiskNetwork(
      query.threshold || 0.7,
      query.limit || 20,
    );
  }
}
