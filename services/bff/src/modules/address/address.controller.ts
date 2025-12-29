import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { AddressQueryDto, TransferQueryDto } from './address.dto';
import { GatewayAuthGuard, JwtAuthGuard } from '../../common/guards';

@ApiTags('addresses')
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) { }

  @Get(':address')
  @UseGuards(GatewayAuthGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get address information' })
  @ApiResponse({ status: 200, description: 'Address information' })
  async getAddressInfo(
    @Param('address') address: string,
    @Query() query: AddressQueryDto,
    @Request() req: any,
  ) {
    // User info from Gateway headers (if via Gateway) or JWT (if direct)
    const user = req.user;
    return this.addressService.getAddressInfo(address, query.network, user);
  }

  @Get(':address/transfers')
  @UseGuards(GatewayAuthGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get address transfers' })
  @ApiResponse({ status: 200, description: 'Address transfers' })
  async getAddressTransfers(
    @Param('address') address: string,
    @Query() query: TransferQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.addressService.getAddressTransfers(address, query, user);
  }

  @Get(':address/stats')
  @UseGuards(GatewayAuthGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get address statistics' })
  @ApiResponse({ status: 200, description: 'Address statistics' })
  async getAddressStats(
    @Param('address') address: string,
    @Query() query: AddressQueryDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.addressService.getAddressStats(address, query.network, user);
  }
}
