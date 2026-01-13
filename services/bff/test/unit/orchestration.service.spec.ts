import { Test, TestingModule } from "@nestjs/testing";
import { OrchestrationService } from "../../src/modules/orchestration/orchestration.service";
import { AddressService } from "../../src/modules/address/address.service";
import { RiskService } from "../../src/modules/risk/risk.service";
import { GraphService } from "../../src/modules/graph/graph.service";
import { AlertService } from "../../src/modules/alert/alert.service";
import * as fixtures from "../mocks/fixtures";

// Mock config
jest.mock("../../src/config/config", () => ({
  getConfig: () => ({
    services: {
      query: { url: "http://query-service:8080", timeout: 5000 },
      risk: { url: "http://risk-service:8000", timeout: 5000 },
      graph: { url: "http://graph-service:8081", timeout: 5000 },
      alert: { url: "http://alert-service:8082", timeout: 5000 },
    },
  }),
}));

describe("OrchestrationService", () => {
  let service: OrchestrationService;
  let addressService: jest.Mocked<AddressService>;
  let riskService: jest.Mocked<RiskService>;
  let graphService: jest.Mocked<GraphService>;
  let alertService: jest.Mocked<AlertService>;

  const mockAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
  const mockAddress2 = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

  beforeEach(async () => {
    const mockAddressService = {
      getAddressInfo: jest.fn(),
      getAddressTransfers: jest.fn(),
    };

    const mockRiskService = {
      scoreAddress: jest.fn(),
    };

    const mockGraphService = {
      getAddressInfo: jest.fn(),
      getAddressNeighbors: jest.fn(),
      getAddressTags: jest.fn(),
      getAddressCluster: jest.fn(),
      findPath: jest.fn(),
      getHighRiskAddresses: jest.fn(),
    };

    const mockAlertService = {
      listHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        { provide: AddressService, useValue: mockAddressService },
        { provide: RiskService, useValue: mockRiskService },
        { provide: GraphService, useValue: mockGraphService },
        { provide: AlertService, useValue: mockAlertService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
    addressService = module.get(AddressService);
    riskService = module.get(RiskService);
    graphService = module.get(GraphService);
    alertService = module.get(AlertService);
  });

  describe("getAddressProfile", () => {
    it("should aggregate address info, risk score, and transfers", async () => {
      addressService.getAddressInfo.mockResolvedValue(fixtures.mockAddressInfo as any);
      riskService.scoreAddress.mockResolvedValue({
        address: mockAddress,
        riskScore: 0.65,
        riskLevel: "medium",
        factors: [],
        tags: [],
        evaluatedAt: new Date().toISOString(),
        cached: false,
        network: "ethereum",
      });
      addressService.getAddressTransfers.mockResolvedValue(fixtures.mockTransferList as any);

      const result = await service.getAddressProfile(mockAddress, "ethereum");

      expect(result.address).toBe(mockAddress);
      expect(result.network).toBe("ethereum");
      expect(result.addressInfo).toEqual(fixtures.mockAddressInfo);
      expect(result.riskScore).toBeDefined();
      expect(result.recentTransfers).toEqual(fixtures.mockTransferList);
      expect(result.orchestratedAt).toBeDefined();
    });

    it("should use fallback when address service fails", async () => {
      addressService.getAddressInfo.mockRejectedValue(new Error("Service unavailable"));
      riskService.scoreAddress.mockResolvedValue({
        address: mockAddress,
        riskScore: 0.65,
        riskLevel: "medium",
        factors: [],
        tags: [],
        evaluatedAt: new Date().toISOString(),
        cached: false,
        network: "ethereum",
      });
      addressService.getAddressTransfers.mockResolvedValue(fixtures.mockTransferList as any);

      const result = await service.getAddressProfile(mockAddress, "ethereum");

      expect(result.addressInfo).toEqual({ error: "Address info unavailable" });
      expect(result.riskScore).toBeDefined();
    });

    it("should call services in parallel", async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      
      addressService.getAddressInfo.mockImplementation(async () => {
        await delay(50);
        return fixtures.mockAddressInfo as any;
      });
      riskService.scoreAddress.mockImplementation(async () => {
        await delay(50);
        return { address: mockAddress, riskScore: 0.5 } as any;
      });
      addressService.getAddressTransfers.mockImplementation(async () => {
        await delay(50);
        return fixtures.mockTransferList as any;
      });

      const start = Date.now();
      await service.getAddressProfile(mockAddress, "ethereum");
      const duration = Date.now() - start;

      // Parallel calls should complete in ~50ms, not ~150ms
      expect(duration).toBeLessThan(120);
    });
  });

  describe("getAddressAnalysis", () => {
    it("should aggregate all data sources", async () => {
      addressService.getAddressInfo.mockResolvedValue(fixtures.mockAddressInfo as any);
      riskService.scoreAddress.mockResolvedValue({
        address: mockAddress,
        riskScore: 0.65,
        riskLevel: "medium",
        factors: [],
        tags: [],
        evaluatedAt: new Date().toISOString(),
        cached: false,
        network: "ethereum",
      });
      graphService.getAddressInfo.mockResolvedValue(fixtures.mockGraphAddressInfo as any);
      graphService.getAddressNeighbors.mockResolvedValue(fixtures.mockAddressNeighbors as any);
      graphService.getAddressTags.mockResolvedValue(["exchange", "high_volume"]);
      graphService.getAddressCluster.mockResolvedValue(fixtures.mockCluster as any);
      alertService.listHistory.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10 });

      const result = await service.getAddressAnalysis(mockAddress, "ethereum", 1, 20);

      expect(result.address).toBe(mockAddress);
      expect(result.basic.addressInfo).toEqual(fixtures.mockAddressInfo);
      expect(result.basic.riskScore).toBeDefined();
      expect(result.graph.graphInfo).toEqual(fixtures.mockGraphAddressInfo);
      expect(result.graph.neighbors).toEqual(fixtures.mockAddressNeighbors);
      expect(result.graph.tags).toEqual(["exchange", "high_volume"]);
      expect(result.graph.cluster).toEqual(fixtures.mockCluster);
      expect(result.alerts).toBeDefined();
    });

    it("should handle partial failures gracefully", async () => {
      addressService.getAddressInfo.mockResolvedValue(fixtures.mockAddressInfo as any);
      riskService.scoreAddress.mockRejectedValue(new Error("Risk service down"));
      graphService.getAddressInfo.mockRejectedValue(new Error("Graph service down"));
      graphService.getAddressNeighbors.mockRejectedValue(new Error("Graph service down"));
      graphService.getAddressTags.mockRejectedValue(new Error("Graph service down"));
      graphService.getAddressCluster.mockRejectedValue(new Error("Graph service down"));
      alertService.listHistory.mockRejectedValue(new Error("Alert service down"));

      const result = await service.getAddressAnalysis(mockAddress, "ethereum", 1, 20);

      expect(result.address).toBe(mockAddress);
      expect(result.basic.addressInfo).toEqual(fixtures.mockAddressInfo);
      expect(result.basic.riskScore).toEqual({ error: "Risk score unavailable" });
      expect(result.graph.tags).toEqual([]);
    });
  });

  describe("findConnection", () => {
    it("should find path and enrich with risk scores", async () => {
      graphService.findPath.mockResolvedValue(fixtures.mockPathResponse as any);
      riskService.scoreAddress
        .mockResolvedValueOnce({ address: mockAddress, riskScore: 0.65 } as any)
        .mockResolvedValueOnce({ address: mockAddress2, riskScore: 0.3 } as any);

      const result = await service.findConnection(mockAddress, mockAddress2, 5, "ethereum");

      expect(result.fromAddress).toBe(mockAddress);
      expect(result.toAddress).toBe(mockAddress2);
      expect(result.path).toEqual(fixtures.mockPathResponse);
      expect(result.fromAddressRisk.riskScore).toBe(0.65);
      expect(result.toAddressRisk.riskScore).toBe(0.3);
    });

    it("should handle path not found", async () => {
      graphService.findPath.mockRejectedValue(new Error("No path found"));
      riskService.scoreAddress.mockResolvedValue({ address: mockAddress, riskScore: 0.5 } as any);

      const result = await service.findConnection(mockAddress, mockAddress2, 5, "ethereum");

      expect(result.path).toEqual({ error: "Path finding failed", found: false });
    });
  });

  describe("getHighRiskNetwork", () => {
    it("should return high risk addresses", async () => {
      const highRiskAddresses = [
        { address: mockAddress, riskScore: 0.85 },
        { address: mockAddress2, riskScore: 0.75 },
      ];
      graphService.getHighRiskAddresses.mockResolvedValue(highRiskAddresses as any);

      const result = await service.getHighRiskNetwork(0.7, 20);

      expect(result.threshold).toBe(0.7);
      expect(result.count).toBe(2);
      expect(result.highRiskAddresses).toEqual(highRiskAddresses);
    });

    it("should handle service failure", async () => {
      graphService.getHighRiskAddresses.mockRejectedValue(new Error("Service unavailable"));

      const result = await service.getHighRiskNetwork(0.7, 20);

      expect(result.count).toBe(0);
      expect(result.highRiskAddresses).toEqual([]);
    });
  });
});
