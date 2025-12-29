import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { TransferQueryDto, AddressInfoResponse, TransferResponse, AddressStatsResponse } from './address.dto';
import { JwtAuthGuard } from '../../common/guards';

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) { }

  @Get(':address')
  @ApiOperation({ summary: 'Get address information' })
  @ApiResponse({ status: 200, description: 'Address info', type: AddressInfoResponse })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async getAddressInfo(
    @Param('address') address: string,
    @Query('network') network: string = 'ethereum',
  ) {
    return this.addressService.getAddressInfo(address, network);
  }

  @Get(':address/transfers')
  @ApiOperation({ summary: 'Get address transfers' })
  @ApiResponse({ status: 200, description: 'Transfer list' })
  async getAddressTransfers(
    @Param('address') address: string,
    @Query() query: TransferQueryDto,
  ) {
    return this.addressService.getAddressTransfers(address, query);
  }

  @Get(':address/stats')
  @ApiOperation({ summary: 'Get address statistics' })
  @ApiResponse({ status: 200, description: 'Address stats', type: AddressStatsResponse })
  async getAddressStats(
    @Param('address') address: string,
    @Query('network') network: string = 'ethereum',
  ) {
    return this.addressService.getAddressStats(address, network);
  }
}
