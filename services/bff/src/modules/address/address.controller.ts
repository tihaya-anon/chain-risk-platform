import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { AddressService } from "./address.service";
import {
  AddressQueryDto,
  TransferQueryDto,
  AddressInfoResponse,
  PaginatedTransfersResponse,
  AddressStatsResponse,
} from "./address.dto";
import { GatewayAuthGuard } from "../../common/guards";
import { GatewayUser } from "../../common/decorators/gateway-user.decorator";
import { UserPayload } from "../auth/auth.dto";
import { getLogger } from "../../common/logger";

const logger = getLogger("AddressController");

@ApiTags("addresses")
@Controller("addresses")
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
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get(":address")
  @ApiOperation({ summary: "Get address information" })
  @ApiResponse({
    status: 200,
    description: "Address information",
    type: AddressInfoResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  @ApiResponse({ status: 404, description: "Address not found" })
  async getAddressInfo(
    @Param("address") address: string,
    @Query() query: AddressQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressInfoResponse> {
    logger.debug("Getting address info", { address, userId: user.sub });
    return this.addressService.getAddressInfo(address, query.network);
  }

  @Get(":address/transfers")
  @ApiOperation({ summary: "Get address transfers" })
  @ApiResponse({
    status: 200,
    description: "Address transfers",
    type: PaginatedTransfersResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  @ApiResponse({ status: 404, description: "Address not found" })
  async getAddressTransfers(
    @Param("address") address: string,
    @Query() query: TransferQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<PaginatedTransfersResponse> {
    logger.debug("Getting address transfers", { address, userId: user.sub });
    return this.addressService.getAddressTransfers(address, query);
  }

  @Get(":address/stats")
  @ApiOperation({ summary: "Get address statistics" })
  @ApiResponse({
    status: 200,
    description: "Address statistics",
    type: AddressStatsResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  @ApiResponse({ status: 404, description: "Address not found" })
  async getAddressStats(
    @Param("address") address: string,
    @Query() query: AddressQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<AddressStatsResponse> {
    logger.debug("Getting address stats", { address, userId: user.sub });
    return this.addressService.getAddressStats(address, query.network);
  }
}
