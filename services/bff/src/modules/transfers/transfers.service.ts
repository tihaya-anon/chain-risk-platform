import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import axios, { AxiosInstance, AxiosError } from "axios";
import { getConfig } from "../../config/config";
import { getLogger } from "../../common/logger";
import {
  ListTransfersQueryDto,
  TransferResponse,
  PaginatedTransfersResponse,
  PaginationMetadata,
} from "./transfers.dto";

const logger = getLogger("TransfersService");

interface QueryServiceResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMetadata;
  error?: {
    message: string;
  };
}

@Injectable()
export class TransfersService {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getConfig();
    this.client = axios.create({
      baseURL: config.services.query.url,
      timeout: config.services.query.timeout,
    });
  }

  async listTransfers(
    query: ListTransfersQueryDto,
  ): Promise<PaginatedTransfersResponse> {
    try {
      const response = await this.client.get<
        QueryServiceResponse<TransferResponse[]>
      >("/api/v1/transfers", { params: query });

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || "Failed to list transfers",
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        items: response.data.data,
        pagination: response.data.meta!,
      };
    } catch (error) {
      this.handleError(error, "listTransfers");
    }
  }

  async getTransferByTxHash(txHash: string): Promise<TransferResponse[]> {
    try {
      const response = await this.client.get<
        QueryServiceResponse<TransferResponse[]>
      >(`/api/v1/transfers/tx/${txHash}`);

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || "Failed to get transfer",
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data.data;
    } catch (error) {
      this.handleError(error, "getTransferByTxHash", txHash);
    }
  }

  private handleError(
    error: unknown,
    method: string,
    identifier?: string,
  ): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status =
        axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        (axiosError.response?.data as any)?.error?.message || axiosError.message;

      logger.error(`${method} failed`, { identifier, status, message });

      if (status === 404) {
        throw new HttpException("Transfer not found", HttpStatus.NOT_FOUND);
      }

      throw new HttpException(message, status);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`${method} unexpected error`, {
      identifier,
      error: errorMessage,
    });
    throw new HttpException(
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
