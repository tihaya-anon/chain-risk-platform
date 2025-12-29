import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../../config/config';
import { getLogger } from '../../common/logger';
import { RiskScoreRequestDto, BatchRiskScoreRequestDto } from './risk.dto';

const logger = getLogger('RiskService');

@Injectable()
export class RiskService {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getConfig();
    this.client = axios.create({
      baseURL: config.services.risk.url,
      timeout: config.services.risk.timeout,
    });
  }

  async scoreAddress(request: RiskScoreRequestDto): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/risk/score', {
        address: request.address,
        network: request.network || 'ethereum',
        include_factors: request.includeFactors ?? true,
      });

      return this.transformResponse(response.data);
    } catch (error) {
      this.handleError(error, 'scoreAddress', request.address);
    }
  }

  async scoreAddressesBatch(request: BatchRiskScoreRequestDto): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/risk/batch', {
        addresses: request.addresses,
        network: request.network || 'ethereum',
        include_factors: request.includeFactors ?? false,
      });

      return {
        results: response.data.results.map((r: any) => this.transformResponse(r)),
        total: response.data.total,
        failed: response.data.failed,
      };
    } catch (error) {
      this.handleError(error, 'scoreAddressesBatch');
    }
  }

  async listRules(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/v1/risk/rules');
      return response.data;
    } catch (error) {
      this.handleError(error, 'listRules');
    }
  }

  private transformResponse(data: any): any {
    // Transform snake_case to camelCase for frontend
    return {
      address: data.address,
      network: data.network,
      riskScore: data.risk_score,
      riskLevel: data.risk_level,
      factors: data.factors || [],
      tags: data.tags || [],
      evaluatedAt: data.evaluated_at,
      cached: data.cached || false,
    };
  }

  private handleError(error: any, method: string, address?: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.detail || error.message;

      logger.error(`${method} failed`, { address, status, message });

      throw new HttpException(message, status);
    }

    logger.error(`${method} unexpected error`, { address, error: error.message });
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
