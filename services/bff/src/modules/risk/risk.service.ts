import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import axios, { AxiosInstance, AxiosError } from "axios";
import { getConfig } from "../../config/config";
import { getLogger } from "../../common/logger";
import {
  RiskScoreRequestDto,
  BatchRiskScoreRequestDto,
  RiskScoreResponse,
  BatchRiskScoreResponse,
  RiskFactorResponse,
  RiskRule,
} from "./risk.dto";

const logger = getLogger("RiskService");

interface RiskServiceRawResponse {
  address: string;
  network: string;
  risk_score: number;
  risk_level: string;
  factors?: Array<{
    name: string;
    score: number;
    weight: number;
    description: string;
    triggered: boolean;
  }>;
  tags?: string[];
  evaluated_at: string;
  cached?: boolean;
}

interface BatchRiskServiceResponse {
  results: RiskServiceRawResponse[];
  total: number;
  failed: number;
}

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

  async scoreAddress(request: RiskScoreRequestDto): Promise<RiskScoreResponse> {
    try {
      const response = await this.client.post<RiskServiceRawResponse>(
        "/api/v1/risk/score",
        {
          address: request.address,
          network: request.network || "ethereum",
          include_factors: request.includeFactors ?? true,
        },
      );

      return this.transformResponse(response.data);
    } catch (error) {
      this.handleError(error, "scoreAddress", request.address);
    }
  }

  async scoreAddressesBatch(
    request: BatchRiskScoreRequestDto,
  ): Promise<BatchRiskScoreResponse> {
    try {
      const response = await this.client.post<BatchRiskServiceResponse>(
        "/api/v1/risk/batch",
        {
          addresses: request.addresses,
          network: request.network || "ethereum",
          include_factors: request.includeFactors ?? false,
        },
      );

      return {
        results: response.data.results.map((r) => this.transformResponse(r)),
        total: response.data.total,
        failed: response.data.failed,
      };
    } catch (error) {
      this.handleError(error, "scoreAddressesBatch");
    }
  }

  async listRules(): Promise<RiskRule[]> {
    try {
      const response = await this.client.get<RiskRule[]>("/api/v1/risk/rules");
      return response.data;
    } catch (error) {
      this.handleError(error, "listRules");
    }
  }

  private transformResponse(data: RiskServiceRawResponse): RiskScoreResponse {
    // Transform snake_case to camelCase for frontend
    return {
      address: data.address,
      network: data.network,
      riskScore: data.risk_score,
      riskLevel: data.risk_level,
      factors: (data.factors || []).map((f) => ({
        name: f.name,
        score: f.score,
        weight: f.weight,
        description: f.description,
        triggered: f.triggered,
      })),
      tags: data.tags || [],
      evaluatedAt: data.evaluated_at,
      cached: data.cached || false,
    };
  }

  private handleError(error: unknown, method: string, address?: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status =
        axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        (axiosError.response?.data as any)?.detail || axiosError.message;

      logger.error(`${method} failed`, { address, status, message });

      throw new HttpException(message, status);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`${method} unexpected error`, {
      address,
      error: errorMessage,
    });
    throw new HttpException(
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
