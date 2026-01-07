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

      // Verify snake_case to camelCase transformation
      expect(result.address).toBe(testAddress);
      expect(result.riskScore).toBe(0.65);
      expect(result.riskLevel).toBe("medium");
      expect(result.evaluatedAt).toBeDefined();
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

    it("should include risk factors when requested", async () => {
      mock.onPost("/api/v1/risk/score").reply(200, fixtures.mockRiskScore);

      const result = await service.scoreAddress({
        address: testAddress,
        includeFactors: true,
      });

      expect(result.factors).toHaveLength(1);
      expect(result.factors[0].name).toBe("high_tx_frequency");
      expect(result.factors[0].triggered).toBe(true);
    });

    it("should handle validation errors", async () => {
      mock.onPost("/api/v1/risk/score").reply(422, {
        detail: "Invalid address format",
      });

      await expect(service.scoreAddress({ address: "invalid" }))
        .rejects
        .toThrow(HttpException);
    });
  });

  describe("scoreAddressesBatch", () => {
    const addresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
      "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    ];

    it("should return batch results", async () => {
      mock.onPost("/api/v1/risk/batch").reply((config) => {
        const body = JSON.parse(config.data);
        const results = body.addresses.map((addr: string) => ({
          ...fixtures.mockRiskScore,
          address: addr,
        }));
        return [200, { results, total: results.length, failed: 0 }];
      });

      const result = await service.scoreAddressesBatch({ addresses });

      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should transform all results to camelCase", async () => {
      mock.onPost("/api/v1/risk/batch").reply(200, fixtures.mockBatchRiskScore);

      const result = await service.scoreAddressesBatch({
        addresses: [addresses[0]],
      });

      expect(result.results[0].riskScore).toBeDefined();
      expect(result.results[0].riskLevel).toBeDefined();
    });
  });

  describe("listRules", () => {
    it("should return risk rules", async () => {
      mock.onGet("/api/v1/risk/rules").reply(200, fixtures.mockRiskRules);

      const result = await service.listRules();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("HighTxFrequencyRule");
    });
  });
});
