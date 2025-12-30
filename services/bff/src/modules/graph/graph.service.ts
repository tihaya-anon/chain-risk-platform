import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { getConfig } from '../../config/config';
import { getLogger } from '../../common/logger';
import {
  AddressInfoResponse,
  AddressNeighborsResponse,
  PathResponse,
  ClusterResponse,
  SyncStatusResponse,
  PropagationResultResponse,
  ClusteringResultResponse,
  AddTagRequestDto,
} from './graph.dto';

const logger = getLogger('GraphService');

@Injectable()
export class GraphService {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getConfig();
    this.client = axios.create({
      baseURL: config.services.graph.url,
      timeout: config.services.graph.timeout,
    });
  }

  // ============== Address Operations ==============

  async getAddressInfo(address: string): Promise<AddressInfoResponse> {
    try {
      const response = await this.client.get<AddressInfoResponse>(
        `/api/graph/address/${address}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAddressInfo', { address });
    }
  }

  async getAddressNeighbors(
    address: string,
    depth: number = 1,
    limit: number = 50,
  ): Promise<AddressNeighborsResponse> {
    try {
      const response = await this.client.get<AddressNeighborsResponse>(
        `/api/graph/address/${address}/neighbors`,
        { params: { depth, limit } },
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAddressNeighbors', { address, depth, limit });
    }
  }

  async getAddressTags(address: string): Promise<string[]> {
    try {
      const response = await this.client.get<string[]>(
        `/api/graph/address/${address}/tags`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAddressTags', { address });
    }
  }

  async addAddressTags(
    address: string,
    request: AddTagRequestDto,
  ): Promise<AddressInfoResponse> {
    try {
      const response = await this.client.post<AddressInfoResponse>(
        `/api/graph/address/${address}/tags`,
        request,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'addAddressTags', { address, tags: request.tags });
    }
  }

  async removeAddressTag(address: string, tag: string): Promise<void> {
    try {
      await this.client.delete(`/api/graph/address/${address}/tags/${tag}`);
    } catch (error) {
      this.handleError(error, 'removeAddressTag', { address, tag });
    }
  }

  async getAddressCluster(address: string): Promise<ClusterResponse> {
    try {
      const response = await this.client.get<ClusterResponse>(
        `/api/graph/address/${address}/cluster`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAddressCluster', { address });
    }
  }

  // ============== Path Operations ==============

  async findPath(
    fromAddress: string,
    toAddress: string,
    maxDepth: number = 5,
  ): Promise<PathResponse> {
    try {
      const response = await this.client.get<PathResponse>(
        `/api/graph/path/${fromAddress}/${toAddress}`,
        { params: { maxDepth } },
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'findPath', { fromAddress, toAddress, maxDepth });
    }
  }

  // ============== Cluster Operations ==============

  async getCluster(clusterId: string): Promise<ClusterResponse> {
    try {
      const response = await this.client.get<ClusterResponse>(
        `/api/graph/cluster/${clusterId}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCluster', { clusterId });
    }
  }

  async runClustering(): Promise<ClusteringResultResponse> {
    try {
      const response = await this.client.post<ClusteringResultResponse>(
        '/api/graph/cluster/run',
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'runClustering');
    }
  }

  async manualCluster(addresses: string[]): Promise<ClusteringResultResponse> {
    try {
      const response = await this.client.post<ClusteringResultResponse>(
        '/api/graph/cluster/manual',
        addresses,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'manualCluster', { addressCount: addresses.length });
    }
  }

  // ============== Search Operations ==============

  async searchByTag(tag: string, limit: number = 50): Promise<AddressInfoResponse[]> {
    try {
      const response = await this.client.get<AddressInfoResponse[]>(
        `/api/graph/search/tag/${tag}`,
        { params: { limit } },
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'searchByTag', { tag, limit });
    }
  }

  async getHighRiskAddresses(
    threshold: number = 0.6,
    limit: number = 50,
  ): Promise<AddressInfoResponse[]> {
    try {
      const response = await this.client.get<AddressInfoResponse[]>(
        '/api/graph/search/high-risk',
        { params: { threshold, limit } },
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getHighRiskAddresses', { threshold, limit });
    }
  }

  // ============== Sync Operations ==============

  async getSyncStatus(): Promise<SyncStatusResponse> {
    try {
      const response = await this.client.get<SyncStatusResponse>(
        '/api/graph/sync/status',
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getSyncStatus');
    }
  }

  async triggerSync(): Promise<SyncStatusResponse> {
    try {
      const response = await this.client.post<SyncStatusResponse>(
        '/api/graph/sync',
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'triggerSync');
    }
  }

  // ============== Propagation Operations ==============

  async propagateTags(): Promise<PropagationResultResponse> {
    try {
      const response = await this.client.post<PropagationResultResponse>(
        '/api/graph/propagate',
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'propagateTags');
    }
  }

  async propagateFromAddress(address: string): Promise<PropagationResultResponse> {
    try {
      const response = await this.client.post<PropagationResultResponse>(
        `/api/graph/propagate/${address}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'propagateFromAddress', { address });
    }
  }

  // ============== Error Handling ==============

  private handleError(error: unknown, method: string, context?: Record<string, unknown>): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const responseData = axiosError.response?.data as Record<string, unknown> | undefined;
      const message = responseData?.message || responseData?.error || axiosError.message;

      logger.error(`${method} failed`, { ...context, status, message });

      if (status === 404) {
        throw new HttpException(
          (message as string) || 'Resource not found',
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(message as string, status);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${method} unexpected error`, { ...context, error: errorMessage });
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
