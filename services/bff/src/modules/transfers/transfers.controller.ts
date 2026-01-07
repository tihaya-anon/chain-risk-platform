import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam } from "@nestjs/swagger";
import { TransfersService } from "./transfers.service";
import {
  ListTransfersQueryDto,
  TransferResponse,
  PaginatedTransfersResponse,
} from "./transfers.dto";
import { GatewayAuthGuard } from "../../common/guards";
import { GatewayUser } from "../../common/decorators/gateway-user.decorator";
import { UserPayload } from "../auth/auth.dto";
import { getLogger } from "../../common/logger";

const logger = getLogger("TransfersController");

@ApiTags("transfers")
@Controller("transfers")
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
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @ApiOperation({ summary: "List transfers" })
  @ApiResponse({
    status: 200,
    description: "Paginated transfers list",
    type: PaginatedTransfersResponse,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  async listTransfers(
    @Query() query: ListTransfersQueryDto,
    @GatewayUser() user: UserPayload,
  ): Promise<PaginatedTransfersResponse> {
    logger.debug("Listing transfers", { query, userId: user.sub });
    return this.transfersService.listTransfers(query);
  }

  @Get("tx/:txHash")
  @ApiOperation({ summary: "Get transfers by transaction hash" })
  @ApiParam({ name: "txHash", description: "Transaction hash" })
  @ApiResponse({
    status: 200,
    description: "Transfers in the transaction",
    type: [TransferResponse],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing Gateway headers",
  })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  async getTransferByTxHash(
    @Param("txHash") txHash: string,
    @GatewayUser() user: UserPayload,
  ): Promise<TransferResponse[]> {
    logger.debug("Getting transfer by tx hash", { txHash, userId: user.sub });
    return this.transfersService.getTransferByTxHash(txHash);
  }
}
