import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
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

  describe("Address Operations", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

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
          message: "Address not found in graph",
        });

        await expect(service.getAddressInfo(testAddress))
          .rejects
          .toThrow(HttpException);
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
        expect(result.depth).toBe(1);
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
      it("should add tags and return success", async () => {
        mock.onPost(`/api/v1/graph/address/${testAddress}/tags`).reply(200, {
          success: true,
          tags: ["exchange", "high_volume", "new_tag"],
        });

        const result = await service.addAddressTags(testAddress, ["new_tag"]);

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Path Operations", () => {
    const fromAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
    const toAddress = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

    describe("findPath", () => {
      it("should find path between addresses", async () => {
        mock.onGet("/api/v1/graph/path").reply(200, fixtures.mockPathResponse);

        const result = await service.findPath(fromAddress, toAddress);

        expect(result.found).toBe(true);
        expect(result.fromAddress).toBe(fromAddress);
        expect(result.toAddress).toBe(toAddress);
        expect(result.path).toHaveLength(1);
      });

      it("should return not found for no path", async () => {
        mock.onGet("/api/v1/graph/path").reply(200, {
          found: false,
          fromAddress,
          toAddress,
          pathLength: 0,
          maxDepth: 5,
          message: "No path found",
          path: [],
        });

        const result = await service.findPath(fromAddress, toAddress);

        expect(result.found).toBe(false);
        expect(result.path).toHaveLength(0);
      });

      it("should pass maxDepth parameter", async () => {
        mock.onGet("/api/v1/graph/path").reply((config) => {
          expect(config.params.from).toBe(fromAddress);
          expect(config.params.to).toBe(toAddress);
          expect(config.params.maxDepth).toBe(3);
          return [200, fixtures.mockPathResponse];
        });

        await service.findPath(fromAddress, toAddress, 3);
      });
    });
  });

  describe("Subgraph Operations", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    describe("getSubgraph", () => {
      it("should return subgraph for address", async () => {
        mock.onGet(`/api/v1/graph/subgraph/${testAddress}`).reply(200,
          fixtures.mockSubgraph,
        );

        const result = await service.getSubgraph(testAddress);

        expect(result.centerAddress).toBe(testAddress);
        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
      });

      it("should pass depth and limit parameters", async () => {
        mock.onGet(`/api/v1/graph/subgraph/${testAddress}`).reply((config) => {
          expect(config.params.depth).toBe(3);
          expect(config.params.limit).toBe(200);
          return [200, fixtures.mockSubgraph];
        });

        await service.getSubgraph(testAddress, 3, 200);
      });
    });
  });

  describe("Cluster Operations", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    describe("getCluster", () => {
      it("should return cluster info for address", async () => {
        mock.onGet(`/api/v1/graph/cluster/${testAddress}`).reply(200,
          fixtures.mockCluster,
        );

        const result = await service.getCluster(testAddress);

        expect(result.id).toBe("cluster-001");
        expect(result.members).toContain(testAddress);
      });

      it("should throw NOT_FOUND when address not in cluster", async () => {
        mock.onGet(`/api/v1/graph/cluster/${testAddress}`).reply(404, {
          message: "Address not found in any cluster",
        });

        await expect(service.getCluster(testAddress))
          .rejects
          .toThrow(HttpException);
      });
    });

    describe("detectClusters", () => {
      it("should detect clusters for addresses", async () => {
        mock.onPost("/api/v1/graph/cluster/detect").reply(200, {
          clusters: [fixtures.mockCluster],
          algorithm: "louvain",
        });

        const result = await service.detectClusters([testAddress]);

        expect(result.clusters).toHaveLength(1);
        expect(result.algorithm).toBe("louvain");
      });
    });
  });

  describe("Statistics Operations", () => {
    describe("getGraphStats", () => {
      it("should return graph statistics", async () => {
        mock.onGet("/api/v1/graph/stats").reply(200, {
          totalNodes: 1000000,
          totalEdges: 5000000,
          avgDegree: 10.5,
          avgRisk: 0.35,
          highRiskCount: 5000,
        });

        const result = await service.getGraphStats();

        expect(result.totalNodes).toBe(1000000);
        expect(result.totalEdges).toBe(5000000);
      });
    });

    describe("getHighRiskAddresses", () => {
      it("should return high risk addresses", async () => {
        mock.onGet("/api/v1/graph/high-risk").reply(200, {
          addresses: [
            { address: testAddress, riskScore: 0.95, tags: ["mixer"] },
          ],
          total: 1,
        });

        const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
        const result = await service.getHighRiskAddresses();

        expect(result.addresses).toHaveLength(1);
        expect(result.addresses[0].riskScore).toBeGreaterThan(0.8);
      });

      it("should pass threshold parameter", async () => {
        mock.onGet("/api/v1/graph/high-risk").reply((config) => {
          expect(config.params.threshold).toBe(0.9);
          return [200, { addresses: [], total: 0 }];
        });

        await service.getHighRiskAddresses(0.9);
      });
    });
  });

  describe("Error Handling", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";

    it("should throw BAD_REQUEST on 400", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).reply(400, {
        message: "Invalid address format",
      });

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(HttpException);
    });

    it("should throw INTERNAL_SERVER_ERROR on 500", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).reply(500, {
        message: "Internal server error",
      });

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(HttpException);
    });

    it("should throw SERVICE_UNAVAILABLE on network error", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).networkError();

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(HttpException);
    });

    it("should throw SERVICE_UNAVAILABLE on timeout", async () => {
      mock.onGet(`/api/v1/graph/address/${testAddress}`).timeout();

      await expect(service.getAddressInfo(testAddress))
        .rejects
        .toThrow(HttpException);
    });
  });
});
