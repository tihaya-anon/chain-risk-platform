import { Test, TestingModule } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import MockAdapter from "axios-mock-adapter";
import { RiskService } from "../../src/modules/risk/risk.service";
import * as fixtures from "../mocks/fixtures";

jest.mock("../../src/config/config", () => ({
  getConfig: () => ({
    services: {
      query: { url: "http://query-service:8080", timeout: 5000 },
      risk: { url: "http://risk-service:8000", timeout: 5000 },
      graph: { url: "http://graph-service:8081", timeout: 5000 },
    },
  }),
}));

describe("RiskService", () => {
  let service: RiskService;
  let mock: MockAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RiskService],
    }).compile();

    service = module.get<RiskService>(RiskService);
    mock = new MockAdapter((service as any).client);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("scoreAddress", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return transformed risk score", async () => {
      mock.onPost("/api/v1/risk/score").reply(200, fixtures.mockRiskScore);

      const result = await service.scoreAddress({ address: testAddress });

      expect(result.address).toBe(testAddress);
      expect(result.riskScore).toBe(0.65);
      expect(result.riskLevel).toBe("medium");
    });

    it("should send correct request body", async () => {
      mock.onPost("/api/v1/risk/score").reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.address).toBe(testAddress);
        expect(body.network).toBe("bsc");
        expect(body.include_factors).toBe(false);
        return [200, fixtures.mockRiskScore];
      });

      await service.scoreAddress({
        address: testAddress,
        network: "bsc",
        includeFactors: false,
      });
    });

    it("should throw on API error", async () => {
      mock.onPost("/api/v1/risk/score").reply(500, {
        detail: "Internal server error",
      });

      await expect(service.scoreAddress({ address: testAddress }))
        .rejects.toThrow(HttpException);
    });
  });

  describe("getHistory", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should return risk history", async () => {
      mock.onGet(`/api/v1/risk/history/${testAddress}`).reply(200, 
        fixtures.mockRiskHistory,
      );

      const result = await service.getHistory(testAddress);

      expect(result).toHaveLength(2);
    });

    it("should pass network parameter", async () => {
      mock.onGet(`/api/v1/risk/history/${testAddress}`).reply((config) => {
        expect(config.params.network).toBe("bsc");
        return [200, fixtures.mockRiskHistory];
      });

      await service.getHistory(testAddress, "bsc");
    });
  });

  describe("scoreAddressesBatch", () => {
    const addresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
      "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    ];

    it("should return batch risk scores", async () => {
      mock.onPost("/api/v1/risk/score/batch").reply(200, fixtures.mockBatchRiskScore);

      const result = await service.scoreAddressesBatch({ addresses });

      expect(result.results).toHaveLength(2);
    });

    it("should transform snake_case to camelCase", async () => {
      mock.onPost("/api/v1/risk/score/batch").reply(200, fixtures.mockBatchRiskScore);

      const result = await service.scoreAddressesBatch({
        addresses: [addresses[0]],
      });

      expect(result.results[0].riskScore).toBeDefined();
      expect(result.results[0].riskLevel).toBeDefined();
    });
  });

  describe("listRules", () => {
    it("should return risk rules", async () => {
      mock.onGet("/api/v1/risk/rules").reply(200, [
        { id: "rule-001", name: "HighTxFrequencyRule", enabled: true },
        { id: "rule-002", name: "LargeTransactionRule", enabled: true },
      ]);

      const result = await service.listRules();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("HighTxFrequencyRule");
    });
  });
});
