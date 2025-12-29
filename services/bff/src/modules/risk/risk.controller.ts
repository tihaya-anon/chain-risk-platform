import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RiskService } from './risk.service';
import {
  RiskScoreRequestDto,
  BatchRiskScoreRequestDto,
  RiskScoreResponse,
  BatchRiskScoreResponse,
} from './risk.dto';
import { JwtAuthGuard } from '../../common/guards';

@ApiTags('risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) { }

  @Post('score')
  @ApiOperation({ summary: 'Get risk score for an address' })
  @ApiResponse({ status: 200, description: 'Risk score', type: RiskScoreResponse })
  async scoreAddress(@Body() request: RiskScoreRequestDto) {
    return this.riskService.scoreAddress(request);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Get risk scores for multiple addresses' })
  @ApiResponse({ status: 200, description: 'Batch risk scores', type: BatchRiskScoreResponse })
  async scoreAddressesBatch(@Body() request: BatchRiskScoreRequestDto) {
    return this.riskService.scoreAddressesBatch(request);
  }

  @Get('rules')
  @ApiOperation({ summary: 'List all risk evaluation rules' })
  @ApiResponse({ status: 200, description: 'List of rules' })
  async listRules() {
    return this.riskService.listRules();
  }
}
