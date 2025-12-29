import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../../config/config';
import { getLogger } from '../../common/logger';

const logger = getLogger('AddressService');

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

  async getAddressInfo(address: string, network: string = 'ethereum'): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/addresses/${address}`, {
        params: { network },
      });

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
  ): Promise<{ items: any[]; pagination: any }> {
    try {
      const response = await this.client.get(`/api/v1/addresses/${address}/transfers`, {
        params: query,
      });

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || 'Failed to get transfers',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        items: response.data.data,
        pagination: response.data.meta,
      };
    } catch (error) {
      this.handleError(error, 'getAddressTransfers', address);
    }
  }

  async getAddressStats(address: string, network: string = 'ethereum'): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/addresses/${address}/stats`, {
        params: { network },
      });

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
  }): Promise<{ items: any[]; pagination: any }> {
    try {
      const response = await this.client.get('/api/v1/transfers', {
        params: query,
      });

      if (!response.data.success) {
        throw new HttpException(
          response.data.error?.message || 'Failed to list transfers',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        items: response.data.data,
        pagination: response.data.meta,
      };
    } catch (error) {
      this.handleError(error, 'listTransfers');
    }
  }

  private handleError(error: any, method: string, address?: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.error?.message || error.message;

      logger.error(`${method} failed`, { address, status, message });

      if (status === 404) {
        throw new HttpException('Address not found', HttpStatus.NOT_FOUND);
      }

      throw new HttpException(message, status);
    }

    logger.error(`${method} unexpected error`, { address, error: error.message });
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
