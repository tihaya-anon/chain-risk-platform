import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { getConfig } from '../../config/config';
import { getLogger } from '../../common/logger';
import {
  AddressInfoResponse,
  PaginatedTransfersResponse,
  AddressStatsResponse,
  TransferResponse,
  PaginationMetadata,
} from './address.dto';

const logger = getLogger('AddressService');

interface QueryServiceResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMetadata;
  error?: {
    message: string;
  };
}

@Injectable()
export class AddressService {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getConfig();
    this.client = axios.create({
      baseURL: config.services.query.url,
      timeout: config.services.query.timeout,
    });
  }

  async getAddressInfo(address: string, network: string = 'ethereum'): Promise<AddressInfoResponse> {
    try {
      const response = await this.client.get<QueryServiceResponse<AddressInfoResponse>>(
        `/api/v1/addresses/${address}`,
        { params: { network } },
      );

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || 'Failed to get address info',
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data.data;
    } catch (error) {
      this.handleError(error, 'getAddressInfo', address);
    }
  }

  async getAddressTransfers(
    address: string,
    query: {
      network?: string;
      page?: number;
      pageSize?: number;
      transferType?: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<PaginatedTransfersResponse> {
    try {
      const response = await this.client.get<QueryServiceResponse<TransferResponse[]>>(
        `/api/v1/addresses/${address}/transfers`,
        { params: query },
      );

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || 'Failed to get transfers',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        items: response.data.data,
        pagination: response.data.meta!,
      };
    } catch (error) {
      this.handleError(error, 'getAddressTransfers', address);
    }
  }

  async getAddressStats(address: string, network: string = 'ethereum'): Promise<AddressStatsResponse> {
    try {
      const response = await this.client.get<QueryServiceResponse<AddressStatsResponse>>(
        `/api/v1/addresses/${address}/stats`,
        { params: { network } },
      );

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || 'Failed to get address stats',
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data.data;
    } catch (error) {
      this.handleError(error, 'getAddressStats', address);
    }
  }

  async listTransfers(query: {
    page?: number;
    pageSize?: number;
    address?: string;
    fromAddress?: string;
    toAddress?: string;
    network?: string;
  }): Promise<PaginatedTransfersResponse> {
    try {
      const response = await this.client.get<QueryServiceResponse<TransferResponse[]>>(
        '/api/v1/transfers',
        { params: query },
      );

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || 'Failed to list transfers',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        items: response.data.data,
        pagination: response.data.meta!,
      };
    } catch (error) {
      this.handleError(error, 'listTransfers');
    }
  }

  private handleError(error: unknown, method: string, address?: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = (axiosError.response?.data as any)?.error?.message || axiosError.message;

      logger.error(`${method} failed`, { address, status, message });

      if (status === 404) {
        throw new HttpException('Address not found', HttpStatus.NOT_FOUND);
      }

      throw new HttpException(message, status);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${method} unexpected error`, { address, error: errorMessage });
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
