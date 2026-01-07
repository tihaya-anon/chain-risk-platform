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

        expect(result.neighbors).toHaveLength(1);
        expect(result.totalCount).toBe(85);
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
      it("should add tags and return updated address", async () => {
        mock.onPost(`/api/v1/graph/address/${testAddress}/tags`).reply((config) => {
          const body = JSON.parse(config.data);
          expect(body.tags).toContain("new_tag");
          return [200, {
            ...fixtures.mockGraphAddressInfo,
            tags: [...fixtures.mockGraphAddressInfo.tags, "new_tag"],
          }];
        });

        const result = await service.addAddressTags(testAddress, {
          tags: ["new_tag"],
          source: "manual",
          confidence: 1.0,
        });

        expect(result.tags).toContain("new_tag");
      });
    });

    describe("removeAddressTag", () => {
      it("should remove tag successfully", async () => {
        mock.onDelete(`/api/v1/graph/address/${testAddress}/tags/old_tag`).reply(200);

        await expect(service.removeAddressTag(testAddress, "old_tag"))
          .resolves
          .not.toThrow();
      });
    });

    describe("getAddressCluster", () => {
      it("should return cluster info", async () => {
        mock.onGet(`/api/v1/graph/address/${testAddress}/cluster`).reply(200,
          fixtures.mockCluster,
        );

        const result = await service.getAddressCluster(testAddress);

        expect(result.clusterId).toBe("cluster_001");
        expect(result.size).toBe(15);
      });
    });
  });

  describe("Path Operations", () => {
    const fromAddr = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
    const toAddr = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

    describe("findPath", () => {
      it("should find path between addresses", async () => {
        mock.onGet(`/api/v1/graph/path/${fromAddr}/${toAddr}`).reply(200,
          fixtures.mockPathResponse,
        );

        const result = await service.findPath(fromAddr, toAddr);

        expect(result.found).toBe(true);
        expect(result.pathLength).toBe(2);
      });

      it("should pass maxDepth param", async () => {
        mock.onGet(`/api/v1/graph/path/${fromAddr}/${toAddr}`).reply((config) => {
          expect(config.params.maxDepth).toBe(3);
          return [200, fixtures.mockPathResponse];
        });

        await service.findPath(fromAddr, toAddr, 3);
      });

      it("should handle no path found", async () => {
        mock.onGet(`/api/v1/graph/path/${fromAddr}/${toAddr}`).reply(200, {
          found: false,
          fromAddress: fromAddr,
          toAddress: toAddr,
          message: "No path found within depth limit",
        });

        const result = await service.findPath(fromAddr, toAddr);

        expect(result.found).toBe(false);
      });
    });
  });

  describe("Cluster Operations", () => {
    describe("getCluster", () => {
      it("should return cluster by ID", async () => {
        mock.onGet("/api/v1/graph/cluster/cluster_001").reply(200, fixtures.mockCluster);

        const result = await service.getCluster("cluster_001");

        expect(result.clusterId).toBe("cluster_001");
        expect(result.addresses).toHaveLength(1);
      });

      it("should handle cluster not found", async () => {
        mock.onGet("/api/v1/graph/cluster/nonexistent").reply(404, {
          message: "Cluster not found",
        });

        await expect(service.getCluster("nonexistent"))
          .rejects
          .toThrow(HttpException);
      });
    });

    describe("runClustering", () => {
      it("should trigger clustering and return result", async () => {
        mock.onPost("/api/v1/graph/cluster/run").reply(200, fixtures.mockClusteringResult);

        const result = await service.runClustering();

        expect(result.status).toBe("completed");
        expect(result.clustersCreated).toBe(25);
      });
    });

    describe("manualCluster", () => {
      it("should create manual cluster", async () => {
        const addresses = ["0xabc", "0xdef"];
        mock.onPost("/api/v1/graph/cluster/manual").reply((config) => {
          expect(JSON.parse(config.data)).toEqual(addresses);
          return [200, fixtures.mockClusteringResult];
        });

        const result = await service.manualCluster(addresses);

        expect(result.status).toBe("completed");
      });
    });
  });

  describe("Search Operations", () => {
    describe("searchByTag", () => {
      it("should return addresses with tag", async () => {
        mock.onGet("/api/v1/graph/search/tag/exchange").reply(200, 
          [fixtures.mockGraphAddressInfo],
        );

        const result = await service.searchByTag("exchange");

        expect(result).toHaveLength(1);
        expect(result[0].tags).toContain("exchange");
      });

      it("should pass limit param", async () => {
        mock.onGet("/api/v1/graph/search/tag/exchange").reply((config) => {
          expect(config.params.limit).toBe(100);
          return [200, []];
        });

        await service.searchByTag("exchange", 100);
      });
    });

    describe("getHighRiskAddresses", () => {
      it("should return high risk addresses", async () => {
        mock.onGet("/api/v1/graph/search/high-risk").reply(200,
          [fixtures.mockGraphAddressInfo],
        );

        const result = await service.getHighRiskAddresses();

        expect(result).toHaveLength(1);
      });

      it("should pass threshold and limit", async () => {
        mock.onGet("/api/v1/graph/search/high-risk").reply((config) => {
          expect(config.params.threshold).toBe(0.8);
          expect(config.params.limit).toBe(20);
          return [200, []];
        });

        await service.getHighRiskAddresses(0.8, 20);
      });
    });
  });

  describe("Propagation Operations", () => {
    describe("propagateTags", () => {
      it("should trigger propagation", async () => {
        mock.onPost("/api/v1/graph/propagate").reply(200, fixtures.mockPropagationResult);

        const result = await service.propagateTags();

        expect(result.status).toBe("completed");
        expect(result.addressesAffected).toBe(150);
      });
    });

    describe("propagateFromAddress", () => {
      it("should propagate from specific address", async () => {
        const addr = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
        mock.onPost(`/api/v1/graph/propagate/${addr}`).reply(200,
          fixtures.mockPropagationResult,
        );

        const result = await service.propagateFromAddress(addr);

        expect(result.status).toBe("completed");
      });
    });
  });
});
