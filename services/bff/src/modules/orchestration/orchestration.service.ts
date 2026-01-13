import { Injectable } from "@nestjs/common";
import { getLogger } from "../../common/logger";
import { AddressService } from "../address/address.service";
import { RiskService } from "../risk/risk.service";
import { GraphService } from "../graph/graph.service";
import { AlertService } from "../alert/alert.service";
import {
  AddressProfileResponse,
  AddressAnalysisResponse,
  ConnectionResponse,
  HighRiskNetworkResponse,
} from "./orchestration.dto";

const logger = getLogger("OrchestrationService");

// TODO: Inject ResilienceService when CP1 is ready
// import { ResilienceService } from "../resilience/resilience.service";

@Injectable()
export class OrchestrationService {
  constructor(
    private readonly addressService: AddressService,
    private readonly riskService: RiskService,
    private readonly graphService: GraphService,
    private readonly alertService: AlertService,
    // TODO: Uncomment when CP1 resilience module is ready
    // @Optional() private readonly resilienceService?: ResilienceService,
  ) {}

  /**
   * Get comprehensive address profile: info + risk + transfers
   */
  async getAddressProfile(
    address: string,
    network: string,
  ): Promise<AddressProfileResponse> {
    logger.info("Orchestrating address profile", { address, network });

    const [addressInfo, riskScore, transfers] = await Promise.all([
      this.safeCall(
        () => this.addressService.getAddressInfo(address, network),
        { error: "Address info unavailable" } as any,
      ),
      this.safeCall(
        () => this.riskService.scoreAddress({ address, network, includeFactors: true }),
        { error: "Risk score unavailable" } as any,
      ),
      this.safeCall(
        () => this.addressService.getAddressTransfers(address, { network, page: 1, pageSize: 10 }),
        { error: "Transfers unavailable" } as any,
      ),
    ]);

    return {
      address,
      network,
      addressInfo,
      riskScore,
      recentTransfers: transfers,
      orchestratedAt: Date.now(),
    };
  }

  /**
   * Get full address analysis: info + risk + graph + alerts
   */
  async getAddressAnalysis(
    address: string,
    network: string,
    neighborDepth: number,
    neighborLimit: number,
  ): Promise<AddressAnalysisResponse> {
    logger.info("Orchestrating address analysis", { address, network, neighborDepth, neighborLimit });

    const [
      addressInfo,
      riskScore,
      graphInfo,
      neighbors,
      tags,
      cluster,
      alerts,
    ] = await Promise.all([
      // Basic info
      this.safeCall(
        () => this.addressService.getAddressInfo(address, network),
        { error: "Address info unavailable" } as any,
      ),
      this.safeCall(
        () => this.riskService.scoreAddress({ address, network, includeFactors: true }),
        { error: "Risk score unavailable" } as any,
      ),
      // Graph info
      this.safeCall(
        () => this.graphService.getAddressInfo(address),
        { error: "Graph info unavailable" } as any,
      ),
      this.safeCall(
        () => this.graphService.getAddressNeighbors(address, neighborDepth, neighborLimit),
        { error: "Neighbors unavailable" } as any,
      ),
      this.safeCall(
        () => this.graphService.getAddressTags(address),
        [] as string[],
      ),
      this.safeCall(
        () => this.graphService.getAddressCluster(address),
        { error: "Cluster info unavailable" } as any,
      ),
      // Alerts
      this.safeCall(
        () => this.alertService.listHistory({ entityId: address, page: 1, pageSize: 10 }),
        { data: [], total: 0, page: 1, pageSize: 10 } as any,
      ),
    ]);

    return {
      address,
      network,
      basic: {
        addressInfo,
        riskScore,
      },
      graph: {
        graphInfo,
        neighbors,
        tags: tags as string[],
        cluster,
      },
      alerts,
      orchestratedAt: Date.now(),
    };
  }

  /**
   * Find connection path between two addresses with risk enrichment
   */
  async findConnection(
    fromAddress: string,
    toAddress: string,
    maxDepth: number,
    network: string,
  ): Promise<ConnectionResponse> {
    logger.info("Finding connection", { fromAddress, toAddress, maxDepth });

    const [path, fromRisk, toRisk] = await Promise.all([
      this.safeCall(
        () => this.graphService.findPath(fromAddress, toAddress, maxDepth),
        { error: "Path finding failed", found: false } as any,
      ),
      this.safeCall(
        () => this.riskService.scoreAddress({ address: fromAddress, network, includeFactors: false }),
        { error: "Risk score unavailable" } as any,
      ),
      this.safeCall(
        () => this.riskService.scoreAddress({ address: toAddress, network, includeFactors: false }),
        { error: "Risk score unavailable" } as any,
      ),
    ]);

    return {
      fromAddress,
      toAddress,
      path,
      fromAddressRisk: fromRisk,
      toAddressRisk: toRisk,
      orchestratedAt: Date.now(),
    };
  }

  /**
   * Get high-risk network addresses
   */
  async getHighRiskNetwork(
    threshold: number,
    limit: number,
  ): Promise<HighRiskNetworkResponse> {
    logger.info("Getting high-risk network", { threshold, limit });

    const addresses = await this.safeCall(
      () => this.graphService.getHighRiskAddresses(threshold, limit),
      [] as any[],
    );

    return {
      threshold,
      count: Array.isArray(addresses) ? addresses.length : 0,
      highRiskAddresses: addresses as Record<string, any>[],
      orchestratedAt: Date.now(),
    };
  }

  /**
   * Safe call wrapper with fallback for partial failure handling
   */
  private async safeCall<T>(
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      // TODO: Wrap with circuit breaker when ResilienceService is ready
      // if (this.resilienceService) {
      //   return await this.resilienceService.execute(fn);
      // }
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn("Service call failed, using fallback", { error: message });
      return fallback;
    }
  }
}
