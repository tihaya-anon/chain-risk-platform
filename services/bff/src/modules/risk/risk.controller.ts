import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { RiskService } from './risk.service';
import { RiskScoreRequestDto, BatchRiskScoreRequestDto } from './risk.dto';
import { GatewayAuthGuard } from '../../common/guards';

@ApiTags('risk')
@Controller('risk')
@UseGuards(GatewayAuthGuard)
@ApiHeader({ name: 'X-User-Id', description: 'User ID (provided by Gateway)', required: true })
@ApiHeader({ name: 'X-User-Username', description: 'Username (provided by Gateway)', required: true })
@ApiHeader({ name: 'X-User-Role', description: 'User role (provided by Gateway)', required: true })
export class RiskController {
  constructor(private readonly riskService: RiskService) { }

  @Post('score')
  @ApiOperation({ summary: 'Calculate risk score for an address' })
  @ApiResponse({ status: 200, description: 'Risk score calculated' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async scoreAddress(@Body() dto: RiskScoreRequestDto, @Request() req: any) {
    // User context available in req.user if needed for logging/auditing
    return this.riskService.scoreAddress(dto);
  }

  @Post('score/batch')
  @ApiOperation({ summary: 'Calculate risk scores for multiple addresses' })
  @ApiResponse({ status: 200, description: 'Risk scores calculated' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async scoreAddressesBatch(@Body() dto: BatchRiskScoreRequestDto, @Request() req: any) {
    return this.riskService.scoreAddressesBatch(dto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all risk rules' })
  @ApiResponse({ status: 200, description: 'Risk rules list' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing Gateway headers' })
  async listRules(@Request() req: any) {
    return this.riskService.listRules();
  }
}
