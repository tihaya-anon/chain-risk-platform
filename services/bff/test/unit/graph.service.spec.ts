import { Test, TestingModule } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import MockAdapter from "axios-mock-adapter";
import { GraphService } from "../../src/modules/graph/graph.service";
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

describe("GraphService", () => {
  let service: GraphService;
  let mock: MockAdapter;
  const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
  const toAddress = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphService],
    }).compile();

    service = module.get<GraphService>(GraphService);
    mock = new MockAdapter((service as any).client);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("getAddressInfo", () => {
    it("should return address info from graph", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).reply(200, 
        fixtures.mockGraphAddressInfo,
      );

      const result = await service.getAddressInfo(testAddress);

      expect(result.address).toBe(testAddress);
      expect(result.riskScore).toBe(0.65);
      expect(result.tags).toContain("exchange");
    });

    it("should throw NOT_FOUND on 404", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).reply(404, {
        message: "Address not found",
      });

      await expect(service.getAddressInfo(testAddress))
        .rejects.toThrow(HttpException);
    });
  });

  describe("getAddressNeighbors", () => {
    it("should return neighbors with default params", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}/neighbors`).reply(200,
        fixtures.mockAddressNeighbors,
      );

      const result = await service.getAddressNeighbors(testAddress);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
    });

    it("should pass depth and limit params", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}/neighbors`).reply((config) => {
        expect(config.params.depth).toBe(2);
        expect(config.params.limit).toBe(100);
        return [200, fixtures.mockAddressNeighbors];
      });

      await service.getAddressNeighbors(testAddress, 2, 100);
    });
  });

  describe("getAddressTags", () => {
    it("should return tags array", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}/tags`).reply(200,
        ["exchange", "high_volume"],
      );

      const result = await service.getAddressTags(testAddress);

      expect(result).toContain("exchange");
      expect(result).toHaveLength(2);
    });
  });

  describe("addAddressTags", () => {
    it("should add tags", async () => {
      mock.onPost(`/api/v1/graph/address/${testAddress}/tags`).reply(200,
        fixtures.mockGraphAddressInfo,
      );

      const result = await service.addAddressTags(testAddress, { tags: ["new_tag"] });

      expect(result.address).toBe(testAddress);
    });
  });

  describe("findPath", () => {
    it("should find path between addresses", async () => {
      mock.onGet(`/api/v1/graph/path/${testAddress}/${toAddress}`).reply(200, 
        fixtures.mockPathResponse,
      );

      const result = await service.findPath(testAddress, toAddress);

      expect(result.found).toBe(true);
      expect(result.fromAddress).toBe(testAddress);
    });

    it("should pass maxDepth parameter", async () => {
      mock.onGet(`/api/v1/graph/path/${testAddress}/${toAddress}`).reply((config) => {
        expect(config.params.maxDepth).toBe(3);
        return [200, fixtures.mockPathResponse];
      });

      await service.findPath(testAddress, toAddress, 3);
    });
  });

  describe("getCluster", () => {
    it("should return cluster info", async () => {
      mock.onGet("/api/v1/graph/cluster/cluster-001").reply(200, fixtures.mockCluster);

      const result = await service.getCluster("cluster-001");

      expect(result.clusterId).toBeDefined();
    });
  });

  describe("getHighRiskAddresses", () => {
    it("should return high risk addresses", async () => {
      mock.onGet("/api/v1/graph/addresses/high-risk").reply(200, [
        fixtures.mockGraphAddressInfo,
      ]);

      const result = await service.getHighRiskAddresses();

      expect(result).toHaveLength(1);
    });

    it("should pass threshold parameter", async () => {
      mock.onGet("/api/v1/graph/addresses/high-risk").reply((config) => {
        expect(config.params.threshold).toBe(0.9);
        return [200, []];
      });

      await service.getHighRiskAddresses(0.9);
    });
  });

  describe("Error Handling", () => {
    it("should throw on network error", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).networkError();

      await expect(service.getAddressInfo(testAddress))
        .rejects.toThrow(HttpException);
    });

    it("should throw on timeout", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).timeout();

      await expect(service.getAddressInfo(testAddress))
        .rejects.toThrow(HttpException);
    });
  });
});
