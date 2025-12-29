import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { AddressQueryDto, TransferQueryDto } from './address.dto';
import { GatewayAuthGuard } from '../../common/guards';

@ApiTags('addresses')
@Controller('addresses')
@UseGuards(GatewayAuthGuard)
@ApiHeader({ name: 'X-User-Id', description: 'User ID (provided by Gateway)', required: true })
@ApiHeader({ name: 'X-User-Username', description: 'Username (provided by Gateway)', required: true })
@ApiHeader({ name: 'X-User-Role', description: 'User role (provided by Gateway)', required: true })
export class AddressController {
  constructor(private readonly addressService: AddressService) { }

  @Get(':address')
  @ApiOperation({ summary: 'Get address information' })
  @ApiResponse({ status: 200, description: 'Address information' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async getAddressInfo(
    @Param('address') address: string,
    @Query() query: AddressQueryDto,
    @Request() req: any,
  ) {
    // User context available in req.user if needed for logging/auditing
    return this.addressService.getAddressInfo(address, query.network);
  }

  @Get(':address/transfers')
  @ApiOperation({ summary: 'Get address transfers' })
  @ApiResponse({ status: 200, description: 'Address transfers' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async getAddressTransfers(
    @Param('address') address: string,
    @Query() query: TransferQueryDto,
    @Request() req: any,
  ) {
    return this.addressService.getAddressTransfers(address, query);
  }

  @Get(':address/stats')
  @ApiOperation({ summary: 'Get address statistics' })
  @ApiResponse({ status: 200, description: 'Address statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async getAddressStats(
    @Param('address') address: string,
    @Query() query: AddressQueryDto,
    @Request() req: any,
  ) {
    return this.addressService.getAddressStats(address, query.network);
  }
}
